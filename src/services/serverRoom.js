// Pure Browser Cross-Device Real-Time Room Sync (Zero External Dependencies)
export function connectServerRoom(serverCode, onMessage) {
  const brokers = [
    'wss://broker.emqx.io:8084/mqtt',
    'wss://broker.hivemq.com:8884/mqtt',
  ];
  const topic = `exolife/astra/v1/room/${serverCode}`;
  const clientId = `astra_${Math.random().toString(36).slice(2, 9)}_${Date.now().toString(36)}`;
  const enc = new TextEncoder();
  const dec = new TextDecoder();

  let ws = null;
  let brokerIdx = 0;
  let closed = false;
  let connected = false;
  let pingTimer = null;
  let retryTimer = null;

  const encodeVarLen = (len) => {
    const out = [];
    do {
      let d = len % 128;
      len = Math.floor(len / 128);
      if (len > 0) d |= 0x80;
      out.push(d);
    } while (len > 0);
    return out;
  };

  const encodeStr = (str) => {
    const b = enc.encode(str);
    return [(b.length >> 8) & 0xff, b.length & 0xff, ...b];
  };

  const connect = () => {
    if (closed) return;
    connected = false;
    try {
      ws = new WebSocket(brokers[brokerIdx % brokers.length], 'mqtt');
      ws.binaryType = 'arraybuffer';
    } catch {
      brokerIdx++;
      retryTimer = setTimeout(connect, 2000);
      return;
    }

    const fallbackTimer = setTimeout(() => {
      if (!connected && !closed) {
        brokerIdx++;
        try {
          ws?.close();
        } catch {}
      }
    }, 4500);

    ws.onopen = () => {
      const varHeader = [0x00, 0x04, 0x4d, 0x51, 0x54, 0x54, 0x04, 0x02, 0x00, 0x3c];
      const payload = encodeStr(clientId);
      const rem = encodeVarLen(varHeader.length + payload.length);
      ws.send(new Uint8Array([0x10, ...rem, ...varHeader, ...payload]));
    };

    ws.onmessage = (evt) => {
      if (!(evt.data instanceof ArrayBuffer)) return;
      const buf = new Uint8Array(evt.data);
      let idx = 0;
      while (idx < buf.length) {
        const header = buf[idx++];
        const pktType = header & 0xf0;
        let mult = 1;
        let remLen = 0;
        let b;
        do {
          if (idx >= buf.length) return;
          b = buf[idx++];
          remLen += (b & 0x7f) * mult;
          mult *= 128;
        } while ((b & 0x80) !== 0);

        const bodyStart = idx;
        const bodyEnd = bodyStart + remLen;
        if (bodyEnd > buf.length) break;
        idx = bodyEnd;

        if (pktType === 0x20) {
          connected = true;
          clearTimeout(fallbackTimer);
          const subBody = [0x00, 0x01, ...encodeStr(topic), 0x00];
          ws.send(new Uint8Array([0x82, ...encodeVarLen(subBody.length), ...subBody]));
          clearInterval(pingTimer);
          pingTimer = setInterval(() => {
            if (ws?.readyState === WebSocket.OPEN) {
              ws.send(new Uint8Array([0xc0, 0x00]));
            }
          }, 25000);
        } else if (pktType === 0x30) {
          try {
            const qos = (header >> 1) & 0x03;
            const tLen = (buf[bodyStart] << 8) | buf[bodyStart + 1];
            let pOffset = bodyStart + 2 + tLen;
            if (qos > 0) pOffset += 2;
            const raw = dec.decode(buf.subarray(pOffset, bodyEnd));
            const msg = JSON.parse(raw);
            if (msg && msg.senderId !== clientId) {
              onMessage(msg);
            }
          } catch {}
        }
      }
    };

    ws.onclose = () => {
      clearTimeout(fallbackTimer);
      clearInterval(pingTimer);
      connected = false;
      if (!closed) {
        retryTimer = setTimeout(connect, 2000);
      }
    };

    ws.onerror = () => {
      try {
        ws?.close();
      } catch {}
    };
  };

  connect();

  return {
    send(data) {
      if (!connected || ws?.readyState !== WebSocket.OPEN) return;
      try {
        const tBytes = encodeStr(topic);
        const pBytes = enc.encode(JSON.stringify({ ...data, senderId: clientId }));
        const rem = encodeVarLen(tBytes.length + pBytes.length);
        const pkt = new Uint8Array(1 + rem.length + tBytes.length + pBytes.length);
        pkt[0] = 0x30;
        pkt.set(rem, 1);
        pkt.set(tBytes, 1 + rem.length);
        pkt.set(pBytes, 1 + rem.length + tBytes.length);
        ws.send(pkt);
      } catch {}
    },
    leave() {
      closed = true;
      clearInterval(pingTimer);
      clearTimeout(retryTimer);
      try {
        ws?.close();
      } catch {}
    },
  };
}
