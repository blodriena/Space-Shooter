(function () {
  let scene, camera, renderer, ship;
  let bullets = [], asteroids = [], explosionParticles = [];
  let score = 0, lives = 3, health = 100, level = 1;
  let spawnTimer = 0, spawnRate = 90, shootCooldown = 0;
  let gameRunning = false, engineGlow, tick = 0;
  const keys = {};

  const root      = document.getElementById('game-root');
  const overlay   = document.getElementById('overlay');
  const scoreEl   = document.getElementById('score-val');
  const levelEl   = document.getElementById('level-val');
  const livesEl   = document.getElementById('lives-val');
  const healthBar = document.getElementById('health-bar');
  const startBtn  = document.getElementById('start-btn');

  function initScene() {
    scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x000010, 0.018);

    camera = new THREE.PerspectiveCamera(70, root.clientWidth / root.clientHeight, 0.1, 200);
    camera.position.set(0, 3, 12);
    camera.lookAt(0, 0, 0);

    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(root.clientWidth, root.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setClearColor(0x000005);
    root.appendChild(renderer.domElement);

    scene.add(new THREE.AmbientLight(0x223344, 1.2));
    const dir = new THREE.DirectionalLight(0x88aaff, 2);
    dir.position.set(5, 10, 5);
    scene.add(dir);
    const back = new THREE.PointLight(0xff4422, 1.5, 30);
    back.position.set(-5, -2, 5);
    scene.add(back);

    buildStarfield();
    buildShip();
  }

  function buildStarfield() {
    const geo = new THREE.BufferGeometry();
    const pos = [];
    for (let i = 0; i < 1200; i++) {
      pos.push(
        (Math.random() - 0.5) * 180,
        (Math.random() - 0.5) * 100,
        (Math.random() - 0.5) * 180
      );
    }
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    scene.add(new THREE.Points(geo, new THREE.PointsMaterial({ color: 0xaaccff, size: 0.22, transparent: true, opacity: 0.85 })));
  }

  function buildShip() {
    ship = new THREE.Group();

    const bodyGeo = new THREE.ConeGeometry(0.35, 1.4, 8);
    bodyGeo.rotateX(Math.PI / 2);
    ship.add(new THREE.Mesh(bodyGeo, new THREE.MeshPhongMaterial({ color: 0x334466, emissive: 0x112244, shininess: 90 })));

    const noseGeo = new THREE.ConeGeometry(0.18, 0.7, 8);
    noseGeo.rotateX(Math.PI / 2);
    const nose = new THREE.Mesh(noseGeo, new THREE.MeshPhongMaterial({ color: 0x77aaff, emissive: 0x115588, shininess: 120 }));
    nose.position.z = -0.95;
    ship.add(nose);

    const wingMat = new THREE.MeshPhongMaterial({ color: 0x223355, emissive: 0x0a1a33, shininess: 60 });
    const wings = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.06, 0.6), wingMat);
    wings.position.z = 0.2;
    ship.add(wings);

    const vFin = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.7, 0.5), wingMat.clone());
    vFin.position.z = 0.5;
    ship.add(vFin);

    const engGeo = new THREE.CylinderGeometry(0.22, 0.28, 0.3, 10);
    engGeo.rotateX(Math.PI / 2);
    const engine = new THREE.Mesh(engGeo, new THREE.MeshPhongMaterial({ color: 0xff6600, emissive: 0xff3300, shininess: 60 }));
    engine.position.z = 0.85;
    ship.add(engine);

    engineGlow = new THREE.PointLight(0xff6600, 3, 4);
    engineGlow.position.z = 1.2;
    ship.add(engineGlow);

    ship.position.set(0, 0, 3);
    scene.add(ship);
  }

  function spawnAsteroid() {
    const group = new THREE.Group();
    const size  = 0.3 + Math.random() * 0.9;
    const cols  = [0x7a5c3a, 0x8a6642, 0x6a4c2a, 0xaa8855, 0x557799];
    const col   = cols[Math.floor(Math.random() * cols.length)];
    const mesh  = new THREE.Mesh(
      new THREE.DodecahedronGeometry(size, Math.floor(Math.random() * 2)),
      new THREE.MeshPhongMaterial({ color: col, emissive: new THREE.Color(col).multiplyScalar(0.15), shininess: 25 })
    );
    mesh.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI);
    group.add(mesh);
    group.position.set((Math.random() - 0.5) * 16, (Math.random() - 0.5) * 7, -50);
    group.userData = { vz: 0.22 + Math.random() * 0.18 + level * 0.04, rx: (Math.random()-0.5)*0.04, ry: (Math.random()-0.5)*0.04, size, hp: Math.ceil(size * 2) };
    scene.add(group);
    asteroids.push(group);
  }

  function fireBullet() {
    [-0.55, 0, 0.55].forEach(offsetX => {
      const geo = new THREE.CylinderGeometry(0.05, 0.05, 0.6, 6);
      geo.rotateX(Math.PI / 2);
      const b = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: 0x00ffff }));
      b.position.copy(ship.position);
      b.position.z -= 1.2;
      b.position.x += offsetX;
      b.add(new THREE.PointLight(0x00ffff, 4, 3));
      b.userData = { vz: -1.8, life: 80 };
      scene.add(b);
      bullets.push(b);
    });
  }

  function spawnExplosion(pos, col) {
    for (let i = 0; i < 18; i++) {
      const p = new THREE.Mesh(
        new THREE.SphereGeometry(0.08 + Math.random() * 0.12, 4, 4),
        new THREE.MeshBasicMaterial({ color: col || 0xff6600, transparent: true })
      );
      p.position.copy(pos);
      p.userData = { v: new THREE.Vector3((Math.random()-0.5)*0.4, (Math.random()-0.5)*0.4, (Math.random()-0.5)*0.4), life: 30 };
      scene.add(p);
      explosionParticles.push(p);
    }
  }

  function updateBullets() {
    bullets = bullets.filter(b => {
      b.position.z += b.userData.vz;
      b.userData.life--;
      if (b.userData.life <= 0 || b.position.z < -60) { scene.remove(b); return false; }
      return true;
    });
  }

  function updateAsteroids() {
    asteroids = asteroids.filter(a => {
      a.position.z += a.userData.vz;
      a.children[0].rotation.x += a.userData.rx;
      a.children[0].rotation.y += a.userData.ry;
      if (a.position.z > 18) { scene.remove(a); return false; }
      return true;
    });
  }

  function updateExplosions() {
    explosionParticles = explosionParticles.filter(p => {
      p.userData.life--;
      p.position.addScaledVector(p.userData.v, 1);
      p.material.opacity = p.userData.life / 30;
      if (p.userData.life <= 0) { scene.remove(p); return false; }
      return true;
    });
  }

  function checkCollisions() {
    for (let i = bullets.length - 1; i >= 0; i--) {
      for (let j = asteroids.length - 1; j >= 0; j--) {
        if (bullets[i].position.distanceTo(asteroids[j].position) < asteroids[j].userData.size + 0.5) {
          spawnExplosion(asteroids[j].position.clone(), 0xff8800);
          scene.remove(bullets[i]); bullets.splice(i, 1);
          asteroids[j].userData.hp--;
          if (asteroids[j].userData.hp <= 0) {
            scene.remove(asteroids[j]); asteroids.splice(j, 1);
            score += Math.ceil(10 * level);
            scoreEl.textContent = score;
            if (score > level * 150) { level++; spawnRate = Math.max(30, spawnRate - 8); levelEl.textContent = level; }
          }
          break;
        }
      }
    }
    for (let j = asteroids.length - 1; j >= 0; j--) {
      if (ship.position.distanceTo(asteroids[j].position) < asteroids[j].userData.size + 0.7) {
        spawnExplosion(ship.position.clone(), 0xff2200);
        scene.remove(asteroids[j]); asteroids.splice(j, 1);
        health -= 25;
        healthBar.style.width = Math.max(0, health) + '%';
        healthBar.style.background = health > 50 ? 'linear-gradient(90deg,#0f8,#0cf)' : health > 25 ? 'linear-gradient(90deg,#fa0,#f80)' : 'linear-gradient(90deg,#f33,#f00)';
        if (health <= 0) {
          health = 100; healthBar.style.width = '100%';
          lives--; livesEl.textContent = '♦'.repeat(Math.max(0, lives));
          if (lives <= 0) endGame();
        }
      }
    }
  }

  function handleInput() {
    const speed = 0.10, xLim = 7, yLim = 3.2;
    if ((keys['ArrowLeft']  || keys['a'] || keys['A']) && ship.position.x > -xLim) { ship.position.x -= speed; ship.rotation.z = Math.min(ship.rotation.z + 0.06, 0.35); }
    else if ((keys['ArrowRight'] || keys['d'] || keys['D']) && ship.position.x < xLim) { ship.position.x += speed; ship.rotation.z = Math.max(ship.rotation.z - 0.06, -0.35); }
    else { ship.rotation.z *= 0.88; }
    if ((keys['ArrowUp']   || keys['w'] || keys['W']) && ship.position.y <  yLim) ship.position.y += speed;
    if ((keys['ArrowDown'] || keys['s'] || keys['S']) && ship.position.y > -yLim) ship.position.y -= speed;
    if (keys[' '] && shootCooldown <= 0) { fireBullet(); shootCooldown = 12; }
    if (shootCooldown > 0) shootCooldown--;
  }

  function endGame() {
    gameRunning = false;
    overlay.style.display = 'flex';
    overlay.innerHTML = `
      <h1>GAME OVER</h1>
      <p style="color:#f88;font-size:15px;margin:8px 0;">Your ship was destroyed</p>
      <p style="color:#7df;font-size:14px;">FINAL SCORE: <b>${score}</b> &nbsp;|&nbsp; LEVEL: <b>${level}</b></p>
      <button id="start-btn">PLAY AGAIN</button>
    `;
    document.getElementById('start-btn').onclick = resetGame;
  }

  function resetGame() {
    bullets.forEach(b => scene.remove(b));
    asteroids.forEach(a => scene.remove(a));
    explosionParticles.forEach(p => scene.remove(p));
    bullets = []; asteroids = []; explosionParticles = [];
    score = 0; lives = 3; health = 100; level = 1; spawnRate = 90; spawnTimer = 0; tick = 0;
    scoreEl.textContent = 0; levelEl.textContent = 1; livesEl.textContent = '♦♦♦';
    healthBar.style.width = '100%'; healthBar.style.background = 'linear-gradient(90deg,#0f8,#0cf)';
    ship.position.set(0, 0, 3); ship.rotation.set(0, 0, 0);
    overlay.style.display = 'none';
    gameRunning = true;
  }

  function animate() {
    requestAnimationFrame(animate);
    if (!gameRunning) { renderer.render(scene, camera); return; }
    tick++;
    handleInput();
    updateBullets();
    updateAsteroids();
    updateExplosions();
    checkCollisions();
    engineGlow.intensity = 2.5 + Math.sin(tick * 0.18) * 1.2;
    spawnTimer++;
    if (spawnTimer >= spawnRate) { spawnAsteroid(); spawnTimer = 0; }
    camera.position.x += (ship.position.x * 0.15 - camera.position.x) * 0.06;
    camera.position.y += (ship.position.y * 0.10 + 3 - camera.position.y) * 0.06;
    camera.lookAt(ship.position.x * 0.1, ship.position.y * 0.1, 0);
    renderer.render(scene, camera);
  }

  document.addEventListener('keydown', e => {
    keys[e.key] = true;
    if ([' ','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.key)) e.preventDefault();
  });
  document.addEventListener('keyup', e => { keys[e.key] = false; });

  startBtn.onclick = () => { overlay.style.display = 'none'; gameRunning = true; };

  initScene();
  animate();
})();