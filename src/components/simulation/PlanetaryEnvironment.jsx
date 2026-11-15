import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import * as coinsStore from '../../utils/coinsManager.js';
import {
  DEFAULT_INVENTORY_FALLBACK,
  MODULE_SPECS,
  LUNAR_ROCK_TYPES,
  MARS_ROCK_TYPES,
  LUNAR_SOIL_LAYERS,
  MARS_SOIL_LAYERS,
} from './planetaryData.js';
import {
  spaceAudio,
  hash2D,
  getTerrainHeight,
  resolveCollisions,
  createPlanetTextures,
  createEarthTexture,
  createEnvironmentMaterials,
  buildRealisticRockMesh,
  buildNasaAstronaut,
  buildMarsRover,
  buildNasaLander,
  createStationMesh,
} from './nasaMeshes.js';
import PlanetaryHUD from './PlanetaryHUD.jsx';
import { emitMissionEvent } from '../../utils/missionEvents.js';
import { setMusicHold } from '../../services/musicService.js';
import { connectServerRoom } from '../../services/serverRoom.js';

function readInventorySafe() {
  if (typeof coinsStore.getInventory === 'function') {
    const inv = coinsStore.getInventory();
    return {
      ...DEFAULT_INVENTORY_FALLBACK,
      ...inv,
      modules: { ...(inv.modules || {}) },
      samples: Array.isArray(inv.samples) ? inv.samples : [],
      tools: Array.isArray(inv.tools) ? inv.tools : ['scoop'],
    };
  }
  return { ...DEFAULT_INVENTORY_FALLBACK, modules: {}, samples: [] };
}

function readUpgradesSafe() {
  if (typeof coinsStore.getUpgrades === 'function') {
    return coinsStore.getUpgrades();
  }
  return {};
}

export default function PlanetaryEnvironment({
  planet = 'moon',
  day = 1,
  resources = {},
  rates = {},
  nasaData = {},
  onUpdateResources,
  lastAction = null,
  onQuickAct,
  onViewRealImage,
  onRewardCoins,
  canAct = false,
  landingTrigger = 0,
  userSession = { username: 'Commander', serverCode: 'SOLO' },
  coins = 100,
  onSpendCoins,
  dailyMission = null,
}) {
  const mountRef = useRef(null);
  const bannerTimerRef = useRef(null);
  const discoveryTimerRef = useRef(null);
  const isRemoteSyncRef = useRef(false);

  const isMars = planet === 'mars';
  const serverCode = String(userSession.serverCode || userSession.classTeam || 'SOLO')
    .trim()
    .toUpperCase();

  const [modules, setModules] = useState([]);
  const [inventory, setInventoryState] = useState(() => {
    coinsStore.seedStarterKit?.();
    return readInventorySafe();
  });
  const [upgrades, setUpgradesState] = useState(readUpgradesSafe);

  const [health, setHealth] = useState(() =>
    typeof resources.health === 'number' ? Math.max(0, Math.min(20, Math.round(resources.health / 5))) : 20
  );
  const [hunger, setHunger] = useState(() =>
    typeof resources.food === 'number' ? Math.max(0, Math.min(20, Math.round(resources.food / 5))) : 18
  );
  const [oxygen, setOxygen] = useState(() =>
    typeof resources.oxygen === 'number' ? Math.max(0, Math.min(100, resources.oxygen)) : 92
  );
  const [water, setWater] = useState(() =>
    typeof resources.water === 'number' ? Math.max(0, Math.min(100, resources.water)) : 90
  );
  const [power, setPower] = useState(() => {
    const initial = resources.power ?? resources.electricity;
    return typeof initial === 'number' ? Math.max(0, Math.min(100, initial)) : 94;
  });
  const [shield, setShield] = useState(() => {
    const initial = resources.shield ?? resources.radiation;
    return typeof initial === 'number' ? Math.max(0, Math.min(100, initial)) : 75;
  });

  const [rationsCount, setRationsCount] = useState(3);
  const [medkitsCount, setMedkitsCount] = useState(1);

  const [discoveredIds, setDiscoveredIds] = useState({});
  const [discoveryToast, setDiscoveryToast] = useState(null);

  const [sampledRocks, setSampledRocks] = useState({});
  const [statusBanner, setStatusBanner] = useState('');
  const [phase, setPhase] = useState('landing');
  const [countdownStep, setCountdownStep] = useState(3);
  const [landerAltitude, setLanderAltitude] = useState(36);
  const [audioMuted, setAudioMuted] = useState(false);

  const [nearbyTarget, setNearbyTarget] = useState(null);
  const [eMenuOpen, setEMenuOpen] = useState(false);
  const [inventoryOpen, setInventoryOpen] = useState(false);
  const [storeOpen, setStoreOpen] = useState(false);
  const [storeTab, setStoreTab] = useState('hardware');
  const [buildMode, setBuildMode] = useState(false);
  // The soundtrack is paused while building (top-view placement) and resumes afterwards.
  useEffect(() => {
    setMusicHold(buildMode);
    return () => setMusicHold(false);
  }, [buildMode]);
  const [selectedInvModuleType, setSelectedInvModuleType] = useState(null);
  const [movingModuleId, setMovingModuleId] = useState(null);
  const [onlineCrewCount, setOnlineCrewCount] = useState(1);

  const [hasDugFirstSample, setHasDugFirstSample] = useState(false);
  const [hasProducedPlantOxygen, setHasProducedPlantOxygen] = useState(false);

  const showBanner = useCallback((msg, duration = 2800) => {
    setStatusBanner(msg);
    if (bannerTimerRef.current) clearTimeout(bannerTimerRef.current);
    if (msg) {
      bannerTimerRef.current = setTimeout(() => setStatusBanner(''), duration);
    }
  }, []);

  const triggerNewDiscovery = useCallback((entry) => {
    if (!entry?.id) return;
    spaceAudio.playDiscoveryFanfare();
    setDiscoveredIds((prev) => {
      if (prev[entry.id]) return prev;
      if (discoveryTimerRef.current) clearTimeout(discoveryTimerRef.current);
      setDiscoveryToast(entry);
      discoveryTimerRef.current = setTimeout(() => setDiscoveryToast(null), 5200);
      return { ...prev, [entry.id]: true };
    });
  }, []);

  useEffect(() => {
    const unlockAudio = () => {
      spaceAudio.startAmbient();
    };
    window.addEventListener('pointerdown', unlockAudio, { once: true });
    window.addEventListener('keydown', unlockAudio, { once: true });
    return () => {
      window.removeEventListener('pointerdown', unlockAudio);
      window.removeEventListener('keydown', unlockAudio);
    };
  }, []);

  useEffect(() => {
    if (typeof resources.health === 'number') {
      setHealth(Math.max(1, Math.min(20, Math.round(resources.health / 5))));
    }
    if (typeof resources.food === 'number') {
      setHunger(Math.max(0, Math.min(20, Math.round(resources.food / 5))));
    }
    if (typeof resources.oxygen === 'number') {
      setOxygen(Math.max(0, Math.min(100, resources.oxygen)));
    }
    if (typeof resources.water === 'number') {
      setWater(Math.max(0, Math.min(100, resources.water)));
    }
    const pVal = resources.power ?? resources.electricity;
    if (typeof pVal === 'number') {
      setPower(Math.max(0, Math.min(100, pVal)));
    }
    const sVal = resources.shield ?? resources.radiation;
    if (typeof sVal === 'number') {
      setShield(Math.max(0, Math.min(100, sVal)));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [day]);

  // Continuous Real-Time Depletion & Regeneration of Life Support & Power
  useEffect(() => {
    if (phase !== 'explore') return;

    const lifeSupportTick = setInterval(() => {
      const activeModules = stateRef.current.modules || [];
      const bioDomes = activeModules.filter((m) => m.type === 'greenhouse').length;
      const o2Plants = activeModules.filter((m) => m.type === 'o2').length;
      const h2oPlants = activeModules.filter((m) => m.type === 'h2o').length;
      const solarArrays = activeModules.filter((m) => m.type === 'solar' || m.type === 'power').length;
      const shieldArrays = activeModules.filter((m) => m.type === 'shield' || m.type === 'habitat').length;

      let nextFoodVal = 18;
      let nextO2Val = 92;
      let nextH2OVal = 90;
      let nextPowerVal = 94;
      let nextShieldVal = 75;

      setHunger((prevFood) => {
        const foodDrop = bioDomes > 0 ? 0.224 : 0.416;
        nextFoodVal = Math.max(0, +(prevFood - foodDrop).toFixed(2));
        return nextFoodVal;
      });

      setOxygen((prevO2) => {
        const baseDrain = 1.024;
        const plantProduction = bioDomes * 2.4 + o2Plants * 2.0;
        nextO2Val = Math.max(0, Math.min(100, +(prevO2 - baseDrain + plantProduction).toFixed(1)));
        return nextO2Val;
      });

      setWater((prevWater) => {
        const waterDrain = 0.896;
        const waterRecovery = h2oPlants * 2.3;
        nextH2OVal = Math.max(0, Math.min(100, +(prevWater - waterDrain + waterRecovery).toFixed(1)));
        return nextH2OVal;
      });

      setPower((prevPower) => {
        const powerDrain = 0.704;
        const powerGen = solarArrays * 2.4;
        nextPowerVal = Math.max(0, Math.min(100, +(prevPower - powerDrain + powerGen).toFixed(1)));
        return nextPowerVal;
      });

      setShield((prevShield) => {
        const radDrain = isMars ? 0.75 : 1.05;
        const shieldBoost = shieldArrays * 1.8;
        nextShieldVal = Math.max(0, Math.min(100, +(prevShield - radDrain + shieldBoost).toFixed(1)));
        return nextShieldVal;
      });

      if (typeof onUpdateResources === 'function') {
        onUpdateResources((prev) => ({
          ...prev,
          oxygen: Math.round(nextO2Val),
          water: Math.round(nextH2OVal),
          food: Math.round((nextFoodVal / 20) * 100),
          power: Math.round(nextPowerVal),
          electricity: Math.round(nextPowerVal),
          shield: Math.round(nextShieldVal),
          radiation: Math.round(nextShieldVal),
        }));
      }
    }, 3500);

    return () => clearInterval(lifeSupportTick);
  }, [phase, isMars, onUpdateResources]);

  // Health impact if Food, Air (O2), Water, or Shield runs critically low
  useEffect(() => {
    if (phase !== 'explore') return;
    const healthCheck = setInterval(() => {
      setHealth((prevHp) => {
        const critical = oxygen <= 5 || water <= 5 || hunger <= 0.5 || shield <= 5;
        let nextHp = prevHp;
        if (critical && prevHp > 1) {
          showBanner('Warning: Critical Life Support or Radiation Shielding! Check O₂, H₂O, Food & Shield.', 3200);
          nextHp = Math.max(1, prevHp - 1);
        } else if (oxygen >= 75 && water >= 70 && hunger >= 15 && shield >= 40 && prevHp < 20) {
          nextHp = Math.min(20, prevHp + 1);
        }
        if (typeof onUpdateResources === 'function' && nextHp !== prevHp) {
          onUpdateResources((prev) => ({ ...prev, health: Math.round((nextHp / 20) * 100) }));
        }
        return nextHp;
      });
    }, 8000);
    return () => clearInterval(healthCheck);
  }, [phase, oxygen, water, hunger, shield, showBanner, onUpdateResources]);

  useEffect(() => {
    const syncInv = () => setInventoryState((prev) => ({ ...prev, ...readInventorySafe() }));
    const syncUpg = () => setUpgradesState(readUpgradesSafe());
    window.addEventListener('astra_inventory_change', syncInv);
    window.addEventListener('astra_upgrades_change', syncUpg);
    return () => {
      window.removeEventListener('astra_inventory_change', syncInv);
      window.removeEventListener('astra_upgrades_change', syncUpg);
      if (bannerTimerRef.current) clearTimeout(bannerTimerRef.current);
      if (discoveryTimerRef.current) clearTimeout(discoveryTimerRef.current);
    };
  }, []);

  const stateRef = useRef({
    canAct,
    onQuickAct,
    onSpendCoins,
    onRewardCoins,
    coins,
    day,
    isMars,
    modules,
    inventory,
    upgrades,
    sampledRocks,
    activeRocks: new Map(),
    digPits: [],
    digAnimTimer: 0,
    capsuleLaunchTimer: 0,
    nearbyTarget: null,
    eMenuOpen: false,
    inventoryOpen: false,
    storeOpen: false,
    buildMode: false,
    selectedInvModuleType: null,
    movingModuleId: null,
    autoTarget: null,
    landingProgress: 0,
    lastCountdownBept: 4,
    isLanding: true,
    sceneModulesMap: new Map(),
    placementGhost: null,
    topCamOffset: { x: 0, z: -2 },
    topCamZoom: 36,
    triggerDigFn: null,
    recenterTopViewFn: null,
    triggerNewDiscovery,
    sendModules: null,
  });

  useEffect(() => {
    Object.assign(stateRef.current, {
      canAct,
      onQuickAct,
      onSpendCoins,
      onRewardCoins,
      coins,
      day,
      modules,
      inventory,
      upgrades,
      sampledRocks,
      eMenuOpen,
      inventoryOpen,
      storeOpen,
      buildMode,
      selectedInvModuleType,
      movingModuleId,
      triggerNewDiscovery,
    });
    if (!buildMode && stateRef.current.placementGhost) {
      stateRef.current.placementGhost.visible = false;
    }
  }, [
    canAct,
    onQuickAct,
    onSpendCoins,
    onRewardCoins,
    coins,
    day,
    modules,
    inventory,
    upgrades,
    sampledRocks,
    eMenuOpen,
    inventoryOpen,
    storeOpen,
    buildMode,
    selectedInvModuleType,
    movingModuleId,
    triggerNewDiscovery,
  ]);

  useEffect(() => {
    if (landingTrigger > 0) {
      stateRef.current.landingProgress = 0;
      stateRef.current.lastCountdownBept = 4;
      stateRef.current.isLanding = true;
      setCountdownStep(3);
      setLanderAltitude(36);
      setPhase('landing');
    }
  }, [landingTrigger]);

  useEffect(() => {
    if (!lastAction?.id) return;
    const targetMod = modules.find((m) => m.actionId === lastAction.id) || modules[0];
    if (targetMod) {
      stateRef.current.autoTarget = { x: targetMod.x, z: targetMod.z + (targetMod.radius || 2) + 1.4 };
      showBanner(`Navigating to ${targetMod.label}`, 2400);
    }
  }, [lastAction, modules, showBanner]);

  useEffect(() => {
    const scene = stateRef.current.scene;
    const gridHelper = stateRef.current.gridHelper;
    const mats = stateRef.current.materials;
    if (gridHelper) gridHelper.visible = buildMode;
    if (!scene || !mats) return;

    for (const [, obj] of stateRef.current.sceneModulesMap.entries()) {
      scene.remove(obj.group);
    }
    stateRef.current.sceneModulesMap.clear();

    modules.forEach((mod) => {
      const created = createStationMesh(mod, mats, upgrades);
      created.group.position.y = getTerrainHeight(mod.x, mod.z, isMars, stateRef.current.digPits);
      scene.add(created.group);
      stateRef.current.sceneModulesMap.set(mod.id, created);
    });

    if (!isRemoteSyncRef.current) {
      stateRef.current.sendModules?.(modules);
    }
    isRemoteSyncRef.current = false;
  }, [modules, upgrades, buildMode, isMars]);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    stateRef.current.isLanding = true;
    stateRef.current.landingProgress = 0;
    stateRef.current.lastCountdownBept = 4;
    stateRef.current.autoTarget = null;
    stateRef.current.sceneModulesMap = new Map();
    stateRef.current.activeRocks = new Map();
    stateRef.current.digPits = [];
    setCountdownStep(3);
    setLanderAltitude(36);
    setPhase('landing');
    setEMenuOpen(false);
    setBuildMode(false);
    setInventoryOpen(false);
    setStoreOpen(false);

    const scene = new THREE.Scene();
    stateRef.current.scene = scene;
    scene.background = new THREE.Color(isMars ? 0x451a0c : 0x010204);
    scene.fog = new THREE.FogExp2(isMars ? 0x7c2d12 : 0x010204, isMars ? 0.0085 : 0.0018);

    const camera = new THREE.PerspectiveCamera(
      52,
      container.clientWidth / Math.max(1, container.clientHeight),
      0.1,
      500
    );

    const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5)); // 2x costs ~80% more pixels for almost no visible gain
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;
    container.appendChild(renderer.domElement);

    const hemiLight = new THREE.HemisphereLight(
      isMars ? 0xffedd5 : 0xcbd5e1,
      isMars ? 0x431407 : 0x06080d,
      isMars ? 0.65 : 0.16
    );
    scene.add(hemiLight);

    const sunLight = new THREE.DirectionalLight(isMars ? 0xffedd5 : 0xffffff, isMars ? 2.4 : 3.2);
    sunLight.position.set(48, 56, 32);
    sunLight.castShadow = true;
    sunLight.shadow.mapSize.set(2048, 2048);
    sunLight.shadow.camera.near = 5;
    sunLight.shadow.camera.far = 170;
    const d = 44;
    sunLight.shadow.camera.left = -d;
    sunLight.shadow.camera.right = d;
    sunLight.shadow.camera.top = d;
    sunLight.shadow.camera.bottom = -d;
    scene.add(sunLight);

    const { materials, disposeMaterials } = createEnvironmentMaterials(isMars);
    stateRef.current.materials = materials;

    // Sky & Earth
    const skyGroup = new THREE.Group();
    const starGeo = new THREE.BufferGeometry();
    const starCount = isMars ? 550 : 2200;
    const starPos = new Float32Array(starCount * 3);
    for (let i = 0; i < starCount * 3; i += 3) {
      const r = 240 + Math.random() * 80;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.random() * Math.PI * 0.49;
      starPos[i] = r * Math.sin(phi) * Math.cos(theta);
      starPos[i + 1] = r * Math.cos(phi) + 14;
      starPos[i + 2] = r * Math.sin(phi) * Math.sin(theta);
    }
    starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
    skyGroup.add(
      new THREE.Points(
        starGeo,
        new THREE.PointsMaterial({ color: 0xffffff, size: isMars ? 0.6 : 0.95, transparent: true, opacity: isMars ? 0.42 : 0.96 })
      )
    );

    let earthTex = null;
    if (!isMars) {
      earthTex = createEarthTexture();
      const earthMesh = new THREE.Mesh(
        new THREE.SphereGeometry(9.5, 36, 36),
        new THREE.MeshStandardMaterial({ map: earthTex, roughness: 0.45, metalness: 0.05 })
      );
      earthMesh.position.set(-72, 74, -145);
      skyGroup.add(earthMesh);
    }
    scene.add(skyGroup);

    // Terrain
    const { map, bumpMap } = createPlanetTextures(isMars);
    const terrainGeo = new THREE.PlaneGeometry(320, 320, 160, 160);
    terrainGeo.rotateX(-Math.PI / 2);
    const terrain = new THREE.Mesh(
      terrainGeo,
      new THREE.MeshStandardMaterial({ map, bumpMap, bumpScale: isMars ? 0.68 : 0.95, roughness: 0.95, metalness: 0.02 })
    );
    terrain.receiveShadow = true;
    scene.add(terrain);

    let lastSnapX = Number.NaN;
    let lastSnapZ = Number.NaN;
    const syncEndlessTerrain = (px, pz, force = false) => {
      const snapX = Math.round(px / 4) * 4;
      const snapZ = Math.round(pz / 4) * 4;
      if (!force && snapX === lastSnapX && snapZ === lastSnapZ) return;
      lastSnapX = snapX;
      lastSnapZ = snapZ;

      terrain.position.set(snapX, 0, snapZ);
      const posAttr = terrainGeo.attributes.position;
      for (let i = 0; i < posAttr.count; i++) {
        const wx = snapX + posAttr.getX(i);
        const wz = snapZ + posAttr.getZ(i);
        posAttr.setY(i, getTerrainHeight(wx, wz, isMars, stateRef.current.digPits));
      }
      posAttr.needsUpdate = true;
      terrainGeo.computeVertexNormals();
      map.offset.set(snapX / 16, -snapZ / 16);
      bumpMap.offset.set(snapX / 16, -snapZ / 16);
    };
    syncEndlessTerrain(0, 0, true);

    const gridHelper = new THREE.GridHelper(96, 48, 0x38bdf8, 0x0ea5e9);
    gridHelper.position.y = 0.08;
    gridHelper.material.transparent = true;
    gridHelper.material.opacity = 0.35;
    gridHelper.visible = false;
    scene.add(gridHelper);
    stateRef.current.gridHelper = gridHelper;

    const placementGhost = new THREE.Mesh(
      new THREE.CylinderGeometry(2.2, 2.2, 0.3, 24),
      new THREE.MeshBasicMaterial({ color: 0x10b981, transparent: true, opacity: 0.45 })
    );
    placementGhost.visible = false;
    scene.add(placementGhost);
    stateRef.current.placementGhost = placementGhost;

    // Mineral Outcrops with Subtle Embedded Glints
    const SECTOR_SIZE = 24;
    const rockTypePool = isMars ? MARS_ROCK_TYPES : LUNAR_ROCK_TYPES;

    const updateDynamicRocks = (px, pz) => {
      const csx = Math.floor(px / SECTOR_SIZE);
      const csz = Math.floor(pz / SECTOR_SIZE);
      const keepIds = new Set();

      for (let dx = -3; dx <= 3; dx++) {
        for (let dz = -3; dz <= 3; dz++) {
          const sx = csx + dx;
          const sz = csz + dz;
          for (let i = 0; i < 5; i++) {
            const id = `rock_${sx}_${sz}_${i}`;
            keepIds.add(id);
            if (stateRef.current.activeRocks.has(id)) continue;

            const h1 = hash2D(sx * 17 + i, sz * 31 + i);
            const h2 = hash2D(sx * 43 + i, sz * 19 + i);
            const h3 = hash2D(sx * 29 + i, sz * 53 + i);
            const rx = sx * SECTOR_SIZE + h1 * SECTOR_SIZE;
            const rz = sz * SECTOR_SIZE + h2 * SECTOR_SIZE;

            if (Math.hypot(rx - 6.5, rz + 2.0) < 7.5) continue;

            const scale = 0.62 + h3 * 1.15;
            const radius = scale * 0.88;
            const spec = rockTypePool[Math.floor(h3 * rockTypePool.length) % rockTypePool.length];
            const mesh = buildRealisticRockMesh(h3, scale, materials.rockMat, spec.speckleColor || spec.accent);
            const gy = getTerrainHeight(rx, rz, isMars, stateRef.current.digPits);
            mesh.position.set(rx, gy + scale * 0.32, rz);
            scene.add(mesh);

            let marker = null;
            if (stateRef.current.sampledRocks[id]) {
              marker = new THREE.Mesh(
                new THREE.RingGeometry(radius * 0.95, radius * 1.18, 24),
                new THREE.MeshBasicMaterial({ color: 0x10b981, side: THREE.DoubleSide })
              );
              marker.rotation.x = -Math.PI / 2;
              marker.position.set(rx, gy + 0.04, rz);
              scene.add(marker);
            }

            stateRef.current.activeRocks.set(id, {
              id,
              specId: spec.id,
              x: rx,
              z: rz,
              radius,
              label: spec.name,
              formula: spec.formula,
              mineral: spec.mineral,
              nasaMission: spec.nasaMission,
              rarity: spec.rarity,
              accent: spec.accent,
              coinReward: spec.coins,
              linkedAction: spec.linkedAction,
              mediaKey: spec.mediaKey,
              mesh,
              marker,
            });
          }
        }
      }

      for (const [id, rObj] of stateRef.current.activeRocks.entries()) {
        if (!keepIds.has(id)) {
          scene.remove(rObj.mesh);
          if (rObj.marker) scene.remove(rObj.marker);
          stateRef.current.activeRocks.delete(id);
        }
      }
    };
    updateDynamicRocks(3.2, 2.0);

    // NASA Lander (Starts at Y = 36 and Descends Downward to Y = 0)
    const { landerGroup, ascentStage, capsuleFlame, flameMesh, parachuteGroup } = buildNasaLander(isMars, materials);
    landerGroup.position.set(6.5, 36, -2);
    scene.add(landerGroup);

    const tagText = `[${serverCode}] ${userSession.username}`;
    const playerEntity = isMars
      ? buildMarsRover(tagText, '#f97316', materials.kaptonMat)
      : buildNasaAstronaut(tagText, '#38bdf8');
    const playerGroup = playerEntity.group;
    playerGroup.position.set(4.5, 0, 1.4);
    playerGroup.visible = false;
    scene.add(playerGroup);

    // Dust Particles
    const dustCount = 85;
    const dustGeo = new THREE.BufferGeometry();
    const dustPositions = new Float32Array(dustCount * 3);
    const dustVelocities = Array.from({ length: dustCount }, () => ({ vx: 0, vy: 0, vz: 0, life: 0 }));
    dustPositions.fill(-50);
    dustGeo.setAttribute('position', new THREE.BufferAttribute(dustPositions, 3));
    const dustPoints = new THREE.Points(
      dustGeo,
      new THREE.PointsMaterial({ color: isMars ? 0xd97706 : 0xcbd5e1, size: 0.25, transparent: true, opacity: 0.78 })
    );
    scene.add(dustPoints);
    let dustCursor = 0;

    // Multi-Layer Repeatable Excavation
    const performShovelDig = () => {
      if (stateRef.current.isLanding || stateRef.current.buildMode || stateRef.current.digAnimTimer > 0) return;

      const digX = playerGroup.position.x + Math.sin(playerGroup.rotation.y) * 1.15;
      const digZ = playerGroup.position.z + Math.cos(playerGroup.rotation.y) * 1.15;

      const blocked =
        Math.hypot(digX - 6.5, digZ + 2.0) < 2.35 ||
        stateRef.current.modules.some((m) => Math.hypot(m.x - digX, m.z - digZ) < (m.radius || 1.5) + 0.55);

      if (blocked) {
        showBanner('Cannot excavate directly beneath spacecraft or base module.', 2800);
        return;
      }

      // Each spot holds ONE kind of deposit (set by where it is on the map) and can be dug
      // up to MAX_DIGS_PER_SPOT times; after that it is mined out.
      const MAX_DIGS_PER_SPOT = 6;
      const spotPit = stateRef.current.digPits.find((p) => Math.hypot(p.x - digX, p.z - digZ) < 1.35);
      if (spotPit && (spotPit.digs || 1) >= MAX_DIGS_PER_SPOT) {
        showBanner(`This spot is mined out (${MAX_DIGS_PER_SPOT}/${MAX_DIGS_PER_SPOT}) — walk to a fresh patch of ground to find more minerals.`, 3200);
        return;
      }

      spaceAudio.playDigSound();

      const hasCoreDrill = (stateRef.current.inventory.tools || []).includes('core_drill');
      const digTier = stateRef.current.upgrades.excavation || 1;
      const depthStep = hasCoreDrill ? 0.34 : 0.24;

      let existingPit = stateRef.current.digPits.find((p) => Math.hypot(p.x - digX, p.z - digZ) < 1.35);
      // Which deposit lies here depends on WHERE you dig (patches ~6 m wide, same every time):
      // common topsoil is most frequent, the rare ice/deep layers are scattered less often.
      const depositRoll = hash2D(Math.round(digX / 6) + (isMars ? 101 : 0), Math.round(digZ / 6) + 7);
      let strataLayer = depositRoll < 0.4 ? 1 : depositRoll < 0.7 ? 2 : depositRoll < 0.9 ? 3 : 4;

      if (existingPit) {
        existingPit.layers = (existingPit.layers || 1) + 1;
        existingPit.depth = Math.min(2.2, existingPit.depth + depthStep);
        existingPit.radius = Math.min(2.3, existingPit.radius + 0.12);
        strataLayer = existingPit.deposit || strataLayer;
        existingPit.digs = (existingPit.digs || 1) + 1;
        if (existingPit.ringMesh) {
          scene.remove(existingPit.ringMesh);
          existingPit.ringMesh.geometry?.dispose();
          existingPit.ringMesh.material?.dispose();
        }
      } else {
        existingPit = {
          x: digX,
          z: digZ,
          depth: depthStep + 0.14,
          radius: hasCoreDrill ? 1.15 : 0.92,
          layers: 1,
          digs: 1,
          deposit: strataLayer,
          ringMesh: null,
        };
        stateRef.current.digPits.push(existingPit);
      }

      stateRef.current.digAnimTimer = 0.65;
      syncEndlessTerrain(playerGroup.position.x, playerGroup.position.z, true);

      const strataColors = isMars
        ? [0x7c2d12, 0x9a3412, 0x581c87, 0x0284c7]
        : [0x334155, 0x1e293b, 0xc2410c, 0x0891b2];
      const pitRing = new THREE.Mesh(
        new THREE.RingGeometry(existingPit.radius * 0.18, existingPit.radius * 1.15, 22),
        new THREE.MeshStandardMaterial({ color: strataColors[strataLayer - 1], roughness: 0.92, side: THREE.DoubleSide })
      );
      pitRing.rotation.x = -Math.PI / 2;
      pitRing.position.set(
        existingPit.x,
        getTerrainHeight(existingPit.x, existingPit.z, isMars, stateRef.current.digPits) + 0.04,
        existingPit.z
      );
      scene.add(pitRing);
      existingPit.ringMesh = pitRing;

      const baseGy = getTerrainHeight(existingPit.x, existingPit.z, isMars, stateRef.current.digPits);
      for (let i = 0; i < 28; i++) {
        const idx = dustCursor % dustCount;
        dustCursor++;
        dustPositions[idx * 3] = existingPit.x + (Math.random() - 0.5) * 0.55;
        dustPositions[idx * 3 + 1] = baseGy + 0.25;
        dustPositions[idx * 3 + 2] = existingPit.z + (Math.random() - 0.5) * 0.55;
        dustVelocities[idx] = {
          vx: (Math.random() - 0.5) * 2.5,
          vy: 1.5 + Math.random() * 1.9,
          vz: (Math.random() - 0.5) * 2.5,
          life: 0.95,
        };
      }

      const pool = isMars ? MARS_SOIL_LAYERS : LUNAR_SOIL_LAYERS;
      const picked = pool[Math.min(pool.length - 1, strataLayer - 1)];
      const tierBonus = digTier === 3 ? 30 : digTier === 2 ? 15 : 0;
      const sampleValue = Math.round(picked.value * (hasCoreDrill ? 1.5 : 1.0) + tierBonus);
      // Digging is cheap routine work: a flat 2 Coins per dig. The real money is in selling samples.
      const immediateCoins = 2;

      const richSample = {
        uid: `soil_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        name: picked.name,
        category: 'soil',
        formula: picked.formula,
        mineral: picked.mineral,
        nasaMission: picked.nasaMission,
        rarity: picked.rarity,
        accent: picked.accent,
        planet,
        mediaKey: 'shovel_dig',
        value: sampleValue,
        collectedDay: stateRef.current.day,
      };

      coinsStore.addSampleToInventory?.(richSample);
      setInventoryState((prev) => ({
        ...prev,
        samples: [richSample, ...(prev.samples || [])],
      }));

      setHasDugFirstSample(true);
      emitMissionEvent('dig');
      stateRef.current.onRewardCoins?.(immediateCoins, `${picked.name} Excavated`);
      stateRef.current.triggerNewDiscovery?.({
        id: picked.id,
        title: picked.name,
        formula: picked.formula,
        subtitle: picked.mineral,
        nasaMission: picked.nasaMission,
        rarity: picked.rarity,
        category: 'soil',
        accent: picked.accent,
        coins: immediateCoins,
      });

      showBanner(`${picked.name} [dig ${existingPit.digs}/${MAX_DIGS_PER_SPOT}] → Inventory (+${immediateCoins} Coins)`, 3400);
    };

    stateRef.current.triggerDigFn = performShovelDig;
    stateRef.current.recenterTopViewFn = () => {
      stateRef.current.topCamOffset = { x: playerGroup.position.x, z: playerGroup.position.z - 4 };
    };

    // Multiplayer Crew Sync (Cross-Device Real-Time via Server Code)
    const remotePlayers = new Map();
    let netRoom = null;

    if (serverCode && serverCode !== 'SOLO') {
      netRoom = connectServerRoom(serverCode, (msg) => {
        if (msg.type === 'leave' && msg.senderId) {
          const entry = remotePlayers.get(msg.senderId);
          if (entry) {
            scene.remove(entry.group);
            entry.nameTexture?.dispose();
            remotePlayers.delete(msg.senderId);
            setOnlineCrewCount(remotePlayers.size + 1);
          }
          return;
        }

        if (msg.type === 'mods' && Array.isArray(msg.modules)) {
          isRemoteSyncRef.current = true;
          setModules((prev) => {
            const prevMap = new Map(prev.map((m) => [m.id, m]));
            let changed = false;
            for (const m of msg.modules) {
              const existing = prevMap.get(m.id);
              if (!existing || existing.x !== m.x || existing.z !== m.z) {
                prevMap.set(m.id, m);
                changed = true;
              }
            }
            return changed ? Array.from(prevMap.values()) : prev;
          });
          return;
        }

        if (msg.type === 'pos' && msg.senderId && msg.username) {
          let entry = remotePlayers.get(msg.senderId);
          if (!entry) {
            const ent = msg.isMars
              ? buildMarsRover(`[${serverCode}] ${msg.username}`, '#10b981', materials.kaptonMat)
              : buildNasaAstronaut(`[${serverCode}] ${msg.username}`, '#10b981');
            scene.add(ent.group);
            entry = { ...ent, lastSeen: Date.now() };
            remotePlayers.set(msg.senderId, entry);
            setOnlineCrewCount(remotePlayers.size + 1);
            showBanner(`${msg.username} joined server [${serverCode}]!`, 2600);
            if (stateRef.current.modules?.length > 0) {
              netRoom?.send({ type: 'mods', modules: stateRef.current.modules });
            }
          }
          entry.group.visible = !stateRef.current.isLanding;
          entry.group.position.set(msg.x ?? 0, msg.y ?? 0, msg.z ?? 0);
          entry.group.rotation.y = msg.rotY ?? 0;
          entry.lastSeen = Date.now();
        }
      });

      stateRef.current.sendModules = (mods) => {
        netRoom?.send({ type: 'mods', modules: mods });
      };
    }

    const broadcastInterval = setInterval(() => {
      if (netRoom && !stateRef.current.isLanding) {
        netRoom.send({
          type: 'pos',
          username: userSession.username,
          x: playerGroup.position.x,
          y: playerGroup.position.y,
          z: playerGroup.position.z,
          rotY: playerGroup.rotation.y,
          isMars,
        });
      }
      const now = Date.now();
      let pruned = false;
      for (const [id, entry] of remotePlayers.entries()) {
        if (now - entry.lastSeen > 8000) {
          scene.remove(entry.group);
          entry.nameTexture?.dispose();
          remotePlayers.delete(id);
          pruned = true;
        }
      }
      if (pruned) setOnlineCrewCount(remotePlayers.size + 1);
    }, 110);

    const handleBeforeUnload = () => {
      netRoom?.send({ type: 'leave' });
    };
    window.addEventListener('beforeunload', handleBeforeUnload);

    // Input Controls
    const keys = {};
    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();
    const domElem = renderer.domElement;

    const onKeyDown = (e) => {
      if (['INPUT', 'TEXTAREA'].includes(document.activeElement?.tagName)) return;
      if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
      keys[e.code] = true;

      if (['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) {
        stateRef.current.autoTarget = null;
      }
      if (e.code === 'KeyF' && !stateRef.current.isLanding && !stateRef.current.buildMode) {
        stateRef.current.triggerDigFn?.();
      }
      if (e.code === 'KeyI' && !stateRef.current.isLanding) {
        setStoreOpen(false);
        setEMenuOpen(false);
        setInventoryOpen((prev) => !prev);
      }
      if (e.code === 'KeyE' && !stateRef.current.isLanding) {
        if (stateRef.current.buildMode) {
          setBuildMode(false);
          setSelectedInvModuleType(null);
          setMovingModuleId(null);
          placementGhost.visible = false;
        } else if (stateRef.current.eMenuOpen) {
          setEMenuOpen(false);
        } else if (stateRef.current.nearbyTarget) {
          setInventoryOpen(false);
          setStoreOpen(false);
          setEMenuOpen(true);
        }
      }
      if (e.code === 'Escape') {
        setEMenuOpen(false);
        setInventoryOpen(false);
        setStoreOpen(false);
        setBuildMode(false);
        setSelectedInvModuleType(null);
        setMovingModuleId(null);
        placementGhost.visible = false;
      }
    };
    const onKeyUp = (e) => {
      keys[e.code] = false;
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);

    let camYaw = 0.35;
    let camPitch = 0.34;
    let camDist = 11.0;
    let isDragging = false;
    let dragMoved = false;
    let prevMouse = { x: 0, y: 0 };

    const onPointerDown = (e) => {
      isDragging = true;
      dragMoved = false;
      prevMouse = { x: e.clientX, y: e.clientY };
    };

    const onPointerMove = (e) => {
      const rect = domElem.getBoundingClientRect();
      pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

      if (stateRef.current.buildMode) {
        if (isDragging) {
          const dx = e.clientX - prevMouse.x;
          const dy = e.clientY - prevMouse.y;
          if (Math.abs(dx) + Math.abs(dy) > 3) dragMoved = true;
          const panScale = stateRef.current.topCamZoom * 0.0018;
          stateRef.current.topCamOffset.x -= dx * panScale;
          stateRef.current.topCamOffset.z -= dy * panScale;
          gridHelper.position.x = Math.round(stateRef.current.topCamOffset.x / 2) * 2;
          gridHelper.position.z = Math.round(stateRef.current.topCamOffset.z / 2) * 2;
          prevMouse = { x: e.clientX, y: e.clientY };
        }
        if (stateRef.current.selectedInvModuleType || stateRef.current.movingModuleId) {
          raycaster.setFromCamera(pointer, camera);
          const hits = raycaster.intersectObject(terrain, false);
          if (hits.length > 0) {
            const snapX = Math.round(hits[0].point.x * 2) / 2;
            const snapZ = Math.round(hits[0].point.z * 2) / 2;
            const blocked =
              Math.hypot(snapX - 6.5, snapZ + 2.0) < 3.6 ||
              stateRef.current.modules.some(
                (m) => m.id !== stateRef.current.movingModuleId && Math.hypot(m.x - snapX, m.z - snapZ) < (m.radius || 2) + 1.4
              );
            placementGhost.visible = true;
            placementGhost.position.set(snapX, getTerrainHeight(snapX, snapZ, isMars, stateRef.current.digPits) + 0.15, snapZ);
            placementGhost.material.color.setHex(blocked ? 0xef4444 : 0x10b981);
          }
        } else {
          placementGhost.visible = false;
        }
        return;
      }

      if (!isDragging) return;
      const dx = e.clientX - prevMouse.x;
      const dy = e.clientY - prevMouse.y;
      if (Math.abs(dx) + Math.abs(dy) > 4) dragMoved = true;
      camYaw -= dx * 0.007;
      camPitch = Math.max(0.14, Math.min(1.15, camPitch + dy * 0.006));
      prevMouse = { x: e.clientX, y: e.clientY };
    };

    const onPointerUp = (e) => {
      const wasDragging = isDragging;
      isDragging = false;
      if (!wasDragging || dragMoved || stateRef.current.isLanding || !stateRef.current.buildMode) return;

      const rect = domElem.getBoundingClientRect();
      pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(pointer, camera);

      if (!stateRef.current.movingModuleId && !stateRef.current.selectedInvModuleType) {
        const hitMeshes = Array.from(stateRef.current.sceneModulesMap.values()).map((o) => o.hitMesh);
        const modHits = raycaster.intersectObjects(hitMeshes, false);
        if (modHits.length > 0 && modHits[0].object.userData?.moduleId) {
          setMovingModuleId(modHits[0].object.userData.moduleId);
          showBanner(`Selected ${modHits[0].object.userData.label}. Click clear ground to reposition.`);
          return;
        }
      }

      const hits = raycaster.intersectObject(terrain, false);
      if (hits.length > 0) {
        const snapX = Math.round(hits[0].point.x * 2) / 2;
        const snapZ = Math.round(hits[0].point.z * 2) / 2;
        const overlaps =
          Math.hypot(snapX - 6.5, snapZ + 2.0) < 3.6 ||
          stateRef.current.modules.some(
            (m) => m.id !== stateRef.current.movingModuleId && Math.hypot(m.x - snapX, m.z - snapZ) < (m.radius || 2) + 1.4
          );
        if (overlaps) {
          showBanner('Location blocked by Lander or existing structure.');
          return;
        }

        if (stateRef.current.movingModuleId) {
          const targetId = stateRef.current.movingModuleId;
          setModules((prev) => prev.map((m) => (m.id === targetId ? { ...m, x: snapX, z: snapZ } : m)));
          setMovingModuleId(null);
          placementGhost.visible = false;
          showBanner('Module repositioned.');
        } else if (stateRef.current.selectedInvModuleType) {
          const mType = stateRef.current.selectedInvModuleType;
          const spec = MODULE_SPECS[mType];
          if (!spec) return;
          const currentQty = stateRef.current.inventory.modules?.[mType] || 0;
          if (currentQty <= 0) return;

          coinsStore.consumeInventoryModule?.(mType);
          setInventoryState((prev) => ({
            ...prev,
            modules: { ...prev.modules, [mType]: Math.max(0, (prev.modules?.[mType] || 1) - 1) },
          }));

          spaceAudio.playBuild();
          setModules((prev) => [
            ...prev,
            {
              id: `mod-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
              type: spec.type,
              actionId: spec.actionId,
              label: spec.label,
              radius: spec.radius,
              cost: spec.cost,
              x: snapX,
              z: snapZ,
            },
          ]);

          stateRef.current.triggerNewDiscovery?.({
            id: `deployed_${mType}_${Date.now()}`,
            title: `${spec.label} Deployed`,
            formula: mType === 'greenhouse' ? 'Photosynthesis O₂ + Crop Production' : 'NASA Surface Infrastructure',
            subtitle:
              mType === 'greenhouse'
                ? 'Bio-Dome is now producing Oxygen (O₂) continuously!'
                : 'Operational outpost subsystem constructed on surface',
            nasaMission: isMars ? 'NASA Mars Surface Architecture' : 'NASA Artemis Base Camp',
            rarity: 'RARE',
            category: 'module',
            accent: '#10b981',
            coins: 15,
          });
          emitMissionEvent('deploy');
          stateRef.current.onRewardCoins?.(15, `${spec.label} Deployed`);
          if (currentQty - 1 <= 0) {
            setSelectedInvModuleType(null);
            placementGhost.visible = false;
          }
          showBanner(
            mType === 'greenhouse'
              ? 'Veggie Plant Bio-Dome Deployed! Plants are now producing Oxygen (O₂) (+15 Coins)!'
              : `Deployed ${spec.label} (+15 Coins)!`
          );
        }
      }
    };

    const onWheel = (e) => {
      e.preventDefault();
      if (stateRef.current.buildMode) {
        stateRef.current.topCamZoom = Math.max(16, Math.min(60, stateRef.current.topCamZoom + e.deltaY * 0.02));
      } else {
        camDist = Math.max(5.5, Math.min(26, camDist + e.deltaY * 0.01));
      }
    };

    domElem.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
    domElem.addEventListener('wheel', onWheel, { passive: false });

    const onResize = () => {
      if (!container) return;
      camera.aspect = container.clientWidth / Math.max(1, container.clientHeight);
      camera.updateProjectionMatrix();
      renderer.setSize(container.clientWidth, container.clientHeight);
    };
    window.addEventListener('resize', onResize);

    // Simulation Loop
    let animId;
    let lastTime = performance.now();
    let vy = 0;
    let isGrounded = true;
    let walkCycle = 0;
    let lastNearestKey = null;
    let lastHudAlt = 36;

    const gravity = isMars ? 11.5 : 4.8;
    const jumpImpulse = isMars ? 5.2 : 5.8;
    const moveSpeed = isMars ? 7.6 : 6.0;
    const playerRadius = isMars ? 1.15 : 0.55;
    let driveAcc = 0; // metres driven since the last mission-progress report

    const animate = (now) => {
      animId = requestAnimationFrame(animate);
      const dt = Math.min(0.05, (now - lastTime) / 1000);
      lastTime = now;

      if (stateRef.current.isLanding) {
        stateRef.current.landingProgress += dt * 0.26;
        const p = Math.min(1, stateRef.current.landingProgress);

        const altitude = 36 * Math.pow(1 - p, 2.2);
        landerGroup.position.y = altitude;
        if (isMars) parachuteGroup.visible = altitude > 10;
        flameMesh.visible = p < 0.98;
        flameMesh.scale.set(1, 0.7 + Math.random() * 0.6, 1);

        const step = p < 0.27 ? 3 : p < 0.54 ? 2 : p < 0.81 ? 1 : 0;
        if (step < stateRef.current.lastCountdownBept) {
          stateRef.current.lastCountdownBept = step;
          setCountdownStep(step);
          spaceAudio.playCountdownBeep(step);
        }
        if (Math.abs(altitude - lastHudAlt) > 0.35 || altitude === 0) {
          lastHudAlt = altitude;
          setLanderAltitude(altitude);
        }

        camera.position.set(19, altitude + 6, 14);
        camera.lookAt(6.5, altitude + 7, -2);

        if (p >= 1) {
          stateRef.current.isLanding = false;
          landerGroup.position.y = 0;
          flameMesh.visible = false;
          parachuteGroup.visible = false;
          playerGroup.visible = true;
          setPhase('explore');
          showBanner(
            'Touchdown! Food, Air (O₂) & Water deplete over the day — collect samples [F]/[E] and build a Plant Bio-Dome to produce O₂!',
            5500
          );
        }
      } else {
        if (stateRef.current.capsuleLaunchTimer > 0) {
          stateRef.current.capsuleLaunchTimer -= dt;
          const progress = 1 - stateRef.current.capsuleLaunchTimer / 3.2;
          ascentStage.position.y = (ascentStage.userData.restY ?? 3.38) + Math.pow(progress, 2) * 58;
          capsuleFlame.visible = true;
          capsuleFlame.position.y = ascentStage.position.y - (ascentStage.userData.flameDrop ?? 1.25);
          if (stateRef.current.capsuleLaunchTimer <= 0) {
            ascentStage.position.y = ascentStage.userData.restY ?? 3.38;
            capsuleFlame.visible = false;
          }
        }

        const modalBlocked =
          stateRef.current.eMenuOpen ||
          stateRef.current.buildMode ||
          stateRef.current.inventoryOpen ||
          stateRef.current.storeOpen;

        let moveX = 0;
        let moveZ = 0;
        if (!modalBlocked && stateRef.current.digAnimTimer <= 0) {
          if (keys['KeyW'] || keys['ArrowUp']) moveZ -= 1;
          if (keys['KeyS'] || keys['ArrowDown']) moveZ += 1;
          if (keys['KeyA'] || keys['ArrowLeft']) moveX -= 1;
          if (keys['KeyD'] || keys['ArrowRight']) moveX += 1;
        }

        let isMoving = false;
        if (moveX !== 0 || moveZ !== 0) {
          const angle = Math.atan2(moveX, moveZ) + camYaw;
          playerGroup.position.x += Math.sin(angle) * moveSpeed * dt;
          playerGroup.position.z += Math.cos(angle) * moveSpeed * dt;
          playerGroup.rotation.y = angle;
          isMoving = true;
        } else if (stateRef.current.autoTarget && !modalBlocked) {
          const dx = stateRef.current.autoTarget.x - playerGroup.position.x;
          const dz = stateRef.current.autoTarget.z - playerGroup.position.z;
          const dist = Math.hypot(dx, dz);
          if (dist > 0.5) {
            const angle = Math.atan2(dx, dz);
            playerGroup.position.x += Math.sin(angle) * moveSpeed * dt;
            playerGroup.position.z += Math.cos(angle) * moveSpeed * dt;
            playerGroup.rotation.y = angle;
            isMoving = true;
          } else {
            stateRef.current.autoTarget = null;
          }
        }

        if (isMoving && !stateRef.current.isLanding) {
          driveAcc += moveSpeed * dt;
          if (driveAcc >= 5) {
            emitMissionEvent('drive', Math.round(driveAcc));
            driveAcc = 0;
          }
        }

        const focusX = stateRef.current.buildMode ? stateRef.current.topCamOffset.x : playerGroup.position.x;
        const focusZ = stateRef.current.buildMode ? stateRef.current.topCamOffset.z : playerGroup.position.z;
        syncEndlessTerrain(focusX, focusZ);
        updateDynamicRocks(focusX, focusZ);
        skyGroup.position.set(focusX, 0, focusZ);

        resolveCollisions(playerGroup.position, playerRadius, [
          ...Array.from(stateRef.current.activeRocks.values()),
          ...stateRef.current.modules.map((m) => ({ x: m.x, z: m.z, radius: m.radius || 1.6 })),
          { x: 6.5, z: -2.0, radius: 2.0 },
        ]);

        if (!isMars && keys['Space'] && isGrounded && !modalBlocked) {
          vy = jumpImpulse;
          isGrounded = false;
          spaceAudio.playJump();
        }

        const groundY = getTerrainHeight(playerGroup.position.x, playerGroup.position.z, isMars, stateRef.current.digPits);
        vy -= gravity * dt;
        playerGroup.position.y += vy * dt;
        if (playerGroup.position.y <= groundY) {
          playerGroup.position.y = groundY;
          if (!isGrounded && vy < -1.2) spaceAudio.playLand();
          vy = 0;
          isGrounded = true;
        }

        for (let i = 0; i < dustCount; i++) {
          const dv = dustVelocities[i];
          if (dv.life > 0) {
            dv.life -= dt;
            dv.vy -= gravity * 0.25 * dt;
            dustPositions[i * 3] += dv.vx * dt;
            dustPositions[i * 3 + 1] += dv.vy * dt;
            dustPositions[i * 3 + 2] += dv.vz * dt;
            if (dv.life <= 0) dustPositions[i * 3 + 1] = -50;
          }
        }
        dustGeo.attributes.position.needsUpdate = true;

        if (stateRef.current.digAnimTimer > 0) {
          stateRef.current.digAnimTimer = Math.max(0, stateRef.current.digAnimTimer - dt);
          const swing = Math.sin((1 - stateRef.current.digAnimTimer / 0.65) * Math.PI);
          if (isMars && playerEntity.armPivot) playerEntity.armPivot.rotation.x = swing * 0.68;
          else if (!isMars) {
            playerGroup.rotation.x = swing * 0.28;
            playerEntity.rightArm.rotation.x = -swing * 1.15;
          }
        } else {
          playerGroup.rotation.x *= 0.8;
          if (isMars && playerEntity.wheels && isMoving) {
            playerEntity.wheels.forEach((w) => {
              w.rotation.x += dt * 7.5;
            });
          } else if (!isMars && isMoving && isGrounded) {
            const prevStep = Math.floor(walkCycle / Math.PI);
            walkCycle += dt * 8.5;
            if (Math.floor(walkCycle / Math.PI) !== prevStep) spaceAudio.playFootstep();
            playerEntity.leftLeg.rotation.x = Math.sin(walkCycle) * 0.65;
            playerEntity.rightLeg.rotation.x = -Math.sin(walkCycle) * 0.65;
          }
        }

        let bestTarget = null;
        let minGap = 2.6;
        const landerGap = Math.hypot(playerGroup.position.x - 6.5, playerGroup.position.z + 2.0) - 2.1;
        if (landerGap < minGap) {
          minGap = landerGap;
          bestTarget = {
            kind: 'lander',
            item: {
              id: 'lander-return',
              label: isMars ? 'Mars Ascent Vehicle (Earth Sample Return)' : 'Lunar Module Ascent Stage (Earth Return)',
              actionId: 'sample_return',
            },
          };
        }
        for (const mod of stateRef.current.modules) {
          const edgeDist = Math.hypot(playerGroup.position.x - mod.x, playerGroup.position.z - mod.z) - (mod.radius || 1.6);
          if (edgeDist < minGap) {
            minGap = edgeDist;
            bestTarget = { kind: 'module', item: mod };
          }
        }
        for (const rock of stateRef.current.activeRocks.values()) {
          const edgeDist = Math.hypot(playerGroup.position.x - rock.x, playerGroup.position.z - rock.z) - rock.radius;
          if (edgeDist < minGap) {
            minGap = edgeDist;
            bestTarget = { kind: 'rock', item: rock };
          }
        }

        const nextKey = bestTarget ? `${bestTarget.kind}:${bestTarget.item.id}` : null;
        if (nextKey !== lastNearestKey) {
          lastNearestKey = nextKey;
          stateRef.current.nearbyTarget = bestTarget;
          setNearbyTarget(bestTarget);
          if (!bestTarget) setEMenuOpen(false);
        }

        if (stateRef.current.buildMode) {
          const tx = stateRef.current.topCamOffset.x;
          const tz = stateRef.current.topCamOffset.z;
          camera.position.lerp(new THREE.Vector3(tx, stateRef.current.topCamZoom, tz + 0.1), 0.16);
          camera.lookAt(tx, 0, tz);
        } else {
          const targetCamX = playerGroup.position.x + Math.sin(camYaw) * Math.cos(camPitch) * camDist;
          const targetCamY = playerGroup.position.y + 1.9 + Math.sin(camPitch) * camDist;
          const targetCamZ = playerGroup.position.z + Math.cos(camYaw) * Math.cos(camPitch) * camDist;
          camera.position.lerp(new THREE.Vector3(targetCamX, targetCamY, targetCamZ), 0.14);
          camera.lookAt(playerGroup.position.x, playerGroup.position.y + 1.35, playerGroup.position.z);
        }
      }

      renderer.render(scene, camera);
    };

    animId = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(animId);
      clearInterval(broadcastInterval);
      stateRef.current.sendModules = null;
      netRoom?.send({ type: 'leave' });
      netRoom?.leave();
      window.removeEventListener('beforeunload', handleBeforeUnload);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      domElem.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      domElem.removeEventListener('wheel', onWheel);
      window.removeEventListener('resize', onResize);

      playerEntity.nameTexture?.dispose();
      remotePlayers.forEach((rp) => rp.nameTexture?.dispose());
      disposeMaterials();
      earthTex?.dispose();
      map.dispose();
      bumpMap.dispose();
      renderer.dispose();
      if (domElem.parentNode === container) container.removeChild(domElem);
    };
  }, [isMars, userSession.username, serverCode, showBanner, planet]);

  /* ==================== HUD Action Handlers ==================== */
  const handleToggleAudio = () => {
    const nextMuted = spaceAudio.toggleMute();
    setAudioMuted(nextMuted);
  };

  const handleEatRation = () => {
    if (rationsCount <= 0) {
      spaceAudio.playError();
      showBanner('No Food & Water Packs left! Buy more in the Store or harvest from a Plant Bio-Dome.');
      return;
    }
    spaceAudio.playEat();
    setRationsCount((c) => c - 1);
    setHunger((h) => Math.min(20, +(h + 6).toFixed(1)));
    setWater((w) => Math.min(100, +(w + 35).toFixed(1)));
    setOxygen((o) => Math.min(100, +(o + 25).toFixed(1)));
    setHealth((hp) => Math.min(20, hp + 2));
    showBanner('Used Crew Provision Pack (+6 Food, +35% Water, +25% O₂)');
  };

  const handleUseMedkit = () => {
    if (medkitsCount <= 0) {
      spaceAudio.playError();
      showBanner('No Medkits available. Purchase one in the Store.');
      return;
    }
    spaceAudio.playHeal();
    setMedkitsCount((c) => c - 1);
    setHealth((hp) => Math.min(20, hp + 8));
    showBanner('Applied EVA Trauma Medkit (+8 Health)');
  };

  const handleHarvestBioDome = () => {
    setEMenuOpen(false);
    setHasProducedPlantOxygen(true);
    emitMissionEvent('harvest');
    spaceAudio.playDiscoveryFanfare();
    setOxygen((o) => Math.min(100, +(o + 35).toFixed(1)));
    setHunger((h) => Math.min(20, +(h + 4).toFixed(1)));
    setRationsCount((c) => c + 2);
    onRewardCoins?.(15, 'Bio-Dome Oxygen & Crop Harvest');
    showBanner('Bio-Dome Harvested: +35% Oxygen (O₂), +4 Food, +2 Rations & +15 Coins!', 3600);
  };

  const handleRunModuleAction = () => {
    if (!nearbyTarget || !onQuickAct) return;
    const actId = nearbyTarget.kind === 'module' ? nearbyTarget.item.actionId : nearbyTarget.item.linkedAction;
    if (!actId) return;
    setEMenuOpen(false);
    onQuickAct(actId);
  };

  const handleSampleRock = () => {
    if (nearbyTarget?.kind !== 'rock') return;
    const rock = nearbyTarget.item;
    setEMenuOpen(false);

    if (sampledRocks[rock.id]) {
      showBanner('Geological core already extracted from this stone.');
      return;
    }

    setSampledRocks((prev) => ({ ...prev, [rock.id]: true }));
    setHasDugFirstSample(true);
    emitMissionEvent('rock');

    const richSample = {
      uid: `rock_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      name: rock.label,
      category: 'rock',
      formula: rock.formula,
      mineral: rock.mineral,
      nasaMission: rock.nasaMission,
      rarity: rock.rarity || 'RARE',
      accent: rock.accent || '#facc15',
      planet,
      mediaKey: rock.mediaKey,
      value: rock.coinReward + 15,
      collectedDay: day,
    };

    coinsStore.addSampleToInventory?.(richSample);
    setInventoryState((prev) => ({
      ...prev,
      samples: [richSample, ...(prev.samples || [])],
    }));

    onRewardCoins?.(15, 'Mineral Specimen Extracted', `rock_${planet}_${rock.id}`);

    triggerNewDiscovery({
      id: rock.specId || rock.id,
      title: rock.label,
      formula: rock.formula,
      subtitle: rock.mineral,
      nasaMission: rock.nasaMission,
      rarity: rock.rarity || 'RARE',
      category: 'rock',
      accent: rock.accent || '#facc15',
      coins: 15,
    });

    showBanner(`Extracted ${rock.label} → +15 Coins & Stored in Inventory!`, 3600);

    const rockEntry = stateRef.current.activeRocks.get(rock.id);
    if (rockEntry && !rockEntry.marker && stateRef.current.scene) {
      const marker = new THREE.Mesh(
        new THREE.RingGeometry(rock.radius * 0.95, rock.radius * 1.18, 24),
        new THREE.MeshBasicMaterial({ color: 0x10b981, side: THREE.DoubleSide })
      );
      marker.rotation.x = -Math.PI / 2;
      const gy = getTerrainHeight(rock.x, rock.z, isMars, stateRef.current.digPits);
      marker.position.set(rock.x, gy + 0.04, rock.z);
      stateRef.current.scene.add(marker);
      rockEntry.marker = marker;
    }
  };

  const handleLaunchSampleReturn = () => {
    setEMenuOpen(false);
    const localCount = inventory.samples?.length || 0;
    const localTotal = (inventory.samples || []).reduce((acc, s) => acc + (s.value || 25), 0);

    const cleared =
      typeof coinsStore.clearInventorySamples === 'function'
        ? coinsStore.clearInventorySamples()
        : { count: localCount, totalValue: localTotal };

    const finalCount = Math.max(cleared.count || 0, localCount);
    const rawTotal = Math.max(cleared.totalValue || 0, localTotal);

    if (finalCount <= 0) {
      showBanner('Sample cargo bay is empty! Dig soil with [F] or sample mineral rocks with [E] first.', 3600);
      return;
    }

    setInventoryState((prev) => ({
      ...prev,
      totalReturnedSamples: (prev.totalReturnedSamples || 0) + finalCount,
      samples: [],
    }));

    const hasCommDish = modules.some((m) => m.type === 'comm');
    const finalPayout = Math.round(rawTotal * (hasCommDish ? 1.35 : 1.0));

    stateRef.current.capsuleLaunchTimer = 3.2;
    spaceAudio.playDiscoveryFanfare();
    emitMissionEvent('capsule');
    onRewardCoins?.(finalPayout, `${finalCount} Samples Returned to Earth`);
    if (canAct && onQuickAct) onQuickAct('sampleReturn');
    showBanner(`Ascent Capsule Launched! ${finalCount} samples returned (+${finalPayout} Coins)`, 4500);
    onViewRealImage?.('sample_return', 'Earth Sample Return Capsule');
  };

  const handleBuyStoreItem = (item) => {
    if (day < item.unlockDay) {
      showBanner(`Locked until Sol ${item.unlockDay}`);
      return false;
    }
    const paid = onSpendCoins ? onSpendCoins(item.cost) : true;
    if (!paid) {
      showBanner(`Insufficient Astro Coins (${item.cost} required).`);
      return false;
    }
    emitMissionEvent('buy');
    if (item.kind === 'consumable') {
      if (item.consumableId === 'ration') {
        setRationsCount((c) => c + 2);
        showBanner('Purchased +2 Food & Water Packs!');
      } else if (item.consumableId === 'medkit') {
        setMedkitsCount((c) => c + 1);
        showBanner('Purchased EVA Trauma Medkit!');
      }
      return true;
    }
    // Tools / modules: the inventory store is the single source of truth. Writing to it fires
    // 'astra_inventory_change', which refreshes the inventory state (so the module shows up in
    // Inventory → Modules). Do NOT also bump the React state by hand – that counted every
    // purchase twice.
    if (item.kind === 'tool') {
      coinsStore.unlockInventoryTool?.(item.toolId);
      showBanner(`Purchased ${item.name}!`);
    } else {
      coinsStore.addInventoryModule?.(item.moduleType, 1);
      showBanner(`Purchased ${item.name} → Added to Inventory › Modules!`);
    }
    return true;
  };

  const handlePurchaseUpgrade = (upgGroup, tierSpec) => {
    if ((upgrades[upgGroup.key] || 1) >= tierSpec.tier || day < tierSpec.unlockDay) return false;
    const paid = onSpendCoins ? onSpendCoins(tierSpec.cost) : true;
    if (!paid) {
      showBanner(`Insufficient Astro Coins (${tierSpec.cost} required).`);
      return false;
    }
    emitMissionEvent('buy');
    coinsStore.setUpgradeTier?.(upgGroup.key, tierSpec.tier);
    setUpgradesState(readUpgradesSafe());
    spaceAudio.playDiscoveryFanfare();
    showBanner(`Upgraded ${upgGroup.name} to ${tierSpec.label}!`, 3500);
    return true;
  };

  const handleRemoveModule = () => {
    if (nearbyTarget?.kind !== 'module') return;
    const mod = nearbyTarget.item;
    coinsStore.addInventoryModule?.(mod.type, 1);
    setInventoryState((prev) => ({
      ...prev,
      modules: { ...prev.modules, [mod.type]: (prev.modules?.[mod.type] || 0) + 1 },
    }));
    setModules((prev) => prev.filter((m) => m.id !== mod.id));
    setEMenuOpen(false);
    setNearbyTarget(null);
    showBanner(`Packed ${mod.label} back into your Inventory.`);
  };

  const handleEnterBuildEdit = () => {
    setEMenuOpen(false);
    setInventoryOpen(false);
    setStoreOpen(false);
    stateRef.current.recenterTopViewFn?.();
    setBuildMode(true);
    if (nearbyTarget?.kind === 'module') setMovingModuleId(nearbyTarget.item.id);
  };

  const handleOpenRealImage = () => {
    if (!nearbyTarget) return;
    setEMenuOpen(false);
    const mediaKey = nearbyTarget.kind === 'rock' ? nearbyTarget.item.mediaKey : nearbyTarget.item.actionId;
    onViewRealImage?.(mediaKey, nearbyTarget.item.label);
  };

  const greenhouseCount = modules.filter((m) => m.type === 'greenhouse').length;
  const o2PlantsCount = modules.filter((m) => m.type === 'o2').length;
  const h2oPlantsCount = modules.filter((m) => m.type === 'h2o').length;
  const solarCount = modules.filter((m) => m.type === 'solar' || m.type === 'power').length;
  const shieldCount = modules.filter((m) => m.type === 'shield' || m.type === 'habitat').length;

  const telemetryRates = useMemo(
    () => ({
      oxygen: +((rates.oxygen ?? 0) - 1.6 + greenhouseCount * 2.4 + o2PlantsCount * 2.0).toFixed(2),
      water: +((rates.water ?? 0) - 1.4 + h2oPlantsCount * 2.3).toFixed(2),
      power: +((rates.power ?? 0) - 1.1 + solarCount * 2.4).toFixed(2),
      food: +((rates.food ?? 0) - (greenhouseCount > 0 ? 1.75 : 3.25)).toFixed(2),
      shield: +((rates.shield ?? 0) - (isMars ? 0.75 : 1.05) + shieldCount * 1.8).toFixed(2),
      health: +((rates.health ?? 0) + (oxygen <= 5 || water <= 5 || hunger <= 0.5 || shield <= 5 ? -5.0 : 0)).toFixed(2),
    }),
    [rates, greenhouseCount, o2PlantsCount, h2oPlantsCount, solarCount, shieldCount, isMars, oxygen, water, hunger, shield]
  );

  const nasaTelemetryInfo = useMemo(
    () => ({
      oxygen:
        nasaData?.oxygenSource ||
        `ISS ECLSS Sabatier + ${greenhouseCount} Active Bio-Dome${greenhouseCount === 1 ? '' : 's'}`,
      water:
        nasaData?.waterSource ||
        (isMars ? 'Mars Subsurface Ice & Regolith Brine Extractor' : 'LCROSS Polar Ice & ISS WPA 98% Loop'),
      power:
        nasaData?.powerSource ||
        (isMars
          ? 'NASA Mars Solar Flux (590 W/m²) + Perseverance MMRTG'
          : 'NASA Lunar Solar Flux (1,361 W/m²) + Kilopower'),
      food: nasaData?.foodSource || 'NASA Advanced Plant Habitat (APH) & Crew Rations',
      shield: nasaData?.shieldSource || 'NASA DONKI Space Weather CME Flux & Regolith Shielding',
      health: nasaData?.healthSource || 'NASA Human Research Program (HRP) EVA Biomedical Telemetry',
    }),
    [nasaData, greenhouseCount, isMars]
  );

  return (
    <div dir="ltr" translate="no" className="notranslate absolute inset-0 overflow-hidden select-none">
      <div ref={mountRef} className="h-full w-full cursor-grab active:cursor-grabbing" />
      <PlanetaryHUD
        isMars={isMars}
        day={day}
        coins={coins}
        userSession={userSession}
        serverCode={serverCode}
        onlineCrewCount={onlineCrewCount}
        phase={phase}
        countdownStep={countdownStep}
        landerAltitude={landerAltitude}
        audioMuted={audioMuted}
        onToggleAudio={handleToggleAudio}
        buildMode={buildMode}
        setBuildMode={setBuildMode}
        health={health}
        hunger={hunger}
        oxygen={oxygen}
        water={water}
        power={power}
        shield={shield}
        telemetryRates={telemetryRates}
        nasaTelemetryInfo={nasaTelemetryInfo}
        greenhouseCount={greenhouseCount}
        rationsCount={rationsCount}
        medkitsCount={medkitsCount}
        onEatRation={handleEatRation}
        onUseMedkit={handleUseMedkit}
        discoveredCount={Object.keys(discoveredIds).length}
        discoveryToast={discoveryToast}
        onDismissDiscovery={() => setDiscoveryToast(null)}
        dailyMission={dailyMission}
        hasDugFirstSample={hasDugFirstSample}
        hasProducedPlantOxygen={hasProducedPlantOxygen}
        greenhouseDeployed={greenhouseCount > 0}
        waterStationDeployed={h2oPlantsCount > 0}
        statusBanner={statusBanner}
        nearbyTarget={nearbyTarget}
        canAct={canAct}
        eMenuOpen={eMenuOpen}
        setEMenuOpen={setEMenuOpen}
        inventoryOpen={inventoryOpen}
        setInventoryOpen={setInventoryOpen}
        inventory={inventory}
        sampledRocks={sampledRocks}
        storeOpen={storeOpen}
        setStoreOpen={setStoreOpen}
        storeTab={storeTab}
        setStoreTab={setStoreTab}
        upgrades={upgrades}
        selectedInvModuleType={selectedInvModuleType}
        setSelectedInvModuleType={setSelectedInvModuleType}
        movingModuleId={movingModuleId}
        setMovingModuleId={setMovingModuleId}
        onTriggerDig={() => stateRef.current.triggerDigFn?.()}
        onEnterBuildEdit={handleEnterBuildEdit}
        onRecenterTopView={() => stateRef.current.recenterTopViewFn?.()}
        onClearGhost={() => {
          if (stateRef.current.placementGhost) stateRef.current.placementGhost.visible = false;
        }}
        onLaunchSampleReturn={handleLaunchSampleReturn}
        onSampleRock={handleSampleRock}
        onHarvestBioDome={handleHarvestBioDome}
        onRunModuleAction={handleRunModuleAction}
        onOpenRealImage={handleOpenRealImage}
        onRemoveModule={handleRemoveModule}
        onBuyStoreItem={handleBuyStoreItem}
        onPurchaseUpgrade={handlePurchaseUpgrade}
        onEquipScoopAndDig={() => {
          coinsStore.setEquippedTool?.('scoop');
          setInventoryOpen(false);
          stateRef.current.triggerDigFn?.();
        }}
        onViewRealImage={onViewRealImage}
      />
    </div>
  );
}