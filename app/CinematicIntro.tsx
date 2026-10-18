"use client";

import { useEffect, useRef, useState } from "react";

export default function CinematicIntro() {
  const section = useRef<HTMLElement>(null);
  const mount = useRef<HTMLDivElement>(null);
  const [chapter, setChapter] = useState(0);
  const [ready, setReady] = useState(false);
  const [paused, setPaused] = useState(false);
  const pauseRef = useRef(false);

  useEffect(() => { pauseRef.current = paused; }, [paused]);

  useEffect(() => {
    let dispose: (() => void) | undefined;
    let cancelled = false;
    const media = matchMedia("(prefers-reduced-motion: reduce)");
    const reduced = media.matches;
    const host = mount.current!;
    const root = section.current!;
    let progress = 0;
    const onScroll = () => {
      const rect = root.getBoundingClientRect();
      progress = Math.min(1, Math.max(0, -rect.top / Math.max(1, root.offsetHeight - innerHeight)));
      root.style.setProperty("--journey", String(progress));
      setChapter(progress < .34 ? 0 : progress < .7 ? 1 : 2);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });

    async function init() {
      const THREE = await import("three");
      if (cancelled) return;
      let renderer: import("three").WebGLRenderer;
      try { renderer = new THREE.WebGLRenderer({ alpha: true, antialias: devicePixelRatio < 2, powerPreference: "low-power" }); }
      catch { return; }
      renderer.setPixelRatio(Math.min(devicePixelRatio, 1.7));
      renderer.setClearColor(0x081311, 0);
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.65;
      host.appendChild(renderer.domElement);
      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(35, 1, .1, 100);
      camera.position.set(0, 0, 12);
      scene.add(new THREE.AmbientLight(0xc8e9da, 1.4));
      const key = new THREE.DirectionalLight(0xeeffbf, 5); key.position.set(-3, 5, 5); scene.add(key);
      const rim = new THREE.PointLight(0x84eccc, 65); rim.position.set(4, -2, 3); scene.add(rim);
      const group = new THREE.Group(); scene.add(group);
      const metal = new THREE.MeshStandardMaterial({ color: 0xbad797, metalness: .82, roughness: .26 });
      const pale = new THREE.MeshStandardMaterial({ color: 0xe1ffb0, metalness: .55, roughness: .28 });
      const dark = new THREE.MeshStandardMaterial({ color: 0x183d30, metalness: .7, roughness: .32 });
      const halo = new THREE.MeshBasicMaterial({ color: 0x9bc785, transparent: true, opacity: .2 });
      [2.45, 2.28, 1.95].forEach((r, i) => {
        const ring = new THREE.Mesh(new THREE.TorusGeometry(r, i === 0 ? .055 : .018, 12, 160), i === 0 ? metal : pale);
        group.add(ring);
      });
      const ticks = new THREE.InstancedMesh(new THREE.BoxGeometry(.018, .1, .025), metal, 120);
      const dummy = new THREE.Object3D();
      for (let i = 0; i < 120; i++) {
        const angle = i / 120 * Math.PI * 2;
        dummy.position.set(Math.sin(angle) * 2.12, Math.cos(angle) * 2.12, 0);
        dummy.rotation.z = -angle;
        dummy.scale.y = i % 10 === 0 ? 2.4 : i % 5 === 0 ? 1.5 : .65;
        dummy.updateMatrix(); ticks.setMatrixAt(i, dummy.matrix);
      }
      group.add(ticks);
      const gyroscope = new THREE.Mesh(new THREE.TorusGeometry(2.75, .009, 8, 140), halo);
      gyroscope.rotation.x = .65; gyroscope.rotation.y = -.3; group.add(gyroscope);
      const needle = new THREE.Group(); group.add(needle);
      const top = new THREE.Mesh(new THREE.ConeGeometry(.54, 1.95, 4), pale);
      top.position.y = .97; top.rotation.y = Math.PI / 4; needle.add(top);
      const bottom = new THREE.Mesh(new THREE.ConeGeometry(.54, 1.95, 4), dark);
      bottom.position.y = -.97; bottom.rotation.z = Math.PI; bottom.rotation.y = Math.PI / 4; needle.add(bottom);
      const hub = new THREE.Mesh(new THREE.SphereGeometry(.13, 24, 16), metal); hub.position.z = .2; needle.add(hub);
      const positions = new Float32Array(450 * 3);
      for (let i = 0; i < positions.length; i++) positions[i] = Math.sin(i * 127.1 + .7) * (i % 3 === 2 ? 4 : 11);
      const starsGeometry = new THREE.BufferGeometry(); starsGeometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
      const stars = new THREE.Points(starsGeometry, new THREE.PointsMaterial({ color: 0xb2e1b0, size: .018, transparent: true, opacity: .5 })); scene.add(stars);
      let width = 0, height = 0, frame = 0, visible = true;
      let pointerX = 0, pointerY = 0, smooth = 0;
      const resize = () => {
        width = host.clientWidth; height = host.clientHeight;
        renderer.setSize(width, height); camera.aspect = width / Math.max(height, 1); camera.updateProjectionMatrix();
      };
      const observer = new ResizeObserver(resize); observer.observe(host); resize();
      const visibility = new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; }); visibility.observe(root);
      const pointer = (e: PointerEvent) => { pointerX = (e.clientX / innerWidth - .5) * .2; pointerY = (e.clientY / innerHeight - .5) * .15; };
      window.addEventListener("pointermove", pointer, { passive: true });
      const clock = new THREE.Clock();
      const draw = () => {
        frame = requestAnimationFrame(draw);
        if (!visible || document.hidden) return;
        const time = clock.getElapsedTime();
        const moving = !reduced && !pauseRef.current;
        smooth += (progress - smooth) * .055;
        const mobile = width < 700;
        group.position.set(mobile ? 0 : 1.9 - smooth * 1.4, mobile ? .55 : .08, 0);
        group.scale.setScalar(mobile ? .74 : .98 + smooth * .12);
        group.rotation.set(moving ? .22 + smooth * .8 + pointerY : .25, moving ? -.3 + pointerX + smooth * .65 : -.2, moving ? -.23 + Math.sin(time * .15) * .04 : -.23);
        needle.rotation.z = moving ? -.55 + smooth * 2.6 + Math.sin(time * .5) * .045 : -.55;
        if (moving) stars.rotation.z = time * .008;
        renderer.render(scene, camera);
      };
      draw(); setReady(true);
      dispose = () => {
        cancelAnimationFrame(frame); observer.disconnect(); visibility.disconnect(); window.removeEventListener("pointermove", pointer);
        scene.traverse(obj => { const mesh = obj as import("three").Mesh; mesh.geometry?.dispose(); const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material]; materials.forEach(m => m?.dispose()); });
        renderer.dispose(); renderer.domElement.remove();
      };
    }
    init().catch(() => { /* The CSS compass remains visible if WebGL is unavailable. */ });
    return () => { cancelled = true; dispose?.(); window.removeEventListener("scroll", onScroll); };
  }, []);

  const chapters = [
    { tag: "01 / THE POSSIBILITY", title: <>The future doesn’t<br/>come with a map.<br/><em>Find your compass.</em></>, copy: "AI is changing the way we work. Your next chapter starts with knowing which direction to take." },
    { tag: "02 / THE DIRECTION", title: <>From a world of AI.<br/>To a skill that’s<br/><em>right for you.</em></>, copy: "Move beyond the noise. Discover a considered collection of courses from the people building AI." },
    { tag: "03 / YOUR NEXT MOVE", title: <>A new skill.<br/>A clearer direction.<br/><em>Your next move.</em></>, copy: "Start with curiosity. Build confidence. Bring something useful back to the work you do every day." },
  ];
  return <section className="cinema" ref={section} aria-label="Discover your AI learning direction">
    <div className="cinema-stage">
      <div className={`compass-scene ${ready ? "is-ready" : ""}`} ref={mount} aria-hidden="true" />
      {!ready && <div className="compass-fallback" aria-hidden="true"><span>✦</span></div>}
      <div className="cinema-vignette"/>
      <div className="cinema-copy" aria-live="off">
        <span className="cinema-kicker"><i/> A FIELD GUIDE TO WHAT’S NEXT</span>
        <div className="chapter-copy" key={chapter}><span className="chapter-label">{chapters[chapter].tag}</span><h1>{chapters[chapter].title}</h1><p>{chapters[chapter].copy}</p></div>
        <div className="cinema-actions"><a href="#courses" className="button cinema-cta">Explore the collection <span>↗</span></a><a href="#pathway" className="cinema-secondary">Find my direction <span>→</span></a></div>
      </div>
      <span className="scene-coordinate">1°17′ N &nbsp; 103°51′ E<br/>SINGAPORE · BUILT FOR WHAT’S NEXT</span>
      <span className="scene-caption">CURIOSITY IS YOUR TRUE NORTH.</span>
      <div className="cinema-bottom"><span className="scroll-cue"><i/> SCROLL TO FIND YOUR DIRECTION</span><div className="chapter-dots">{chapters.map((_,i)=><span key={i} className={i===chapter?"current":""}>0{i+1}</span>)}</div><button className="motion-toggle" onClick={()=>setPaused(!paused)} aria-pressed={paused}>{paused?"Play motion ↗":"Pause motion Ⅱ"}</button></div>
      <div className="journey-progress"/>
    </div>
  </section>;
}
