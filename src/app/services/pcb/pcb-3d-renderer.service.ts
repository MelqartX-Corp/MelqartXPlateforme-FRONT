import { Injectable } from '@angular/core';
import type * as ThreeNS from 'three';
import type { OrbitControls as OrbitControlsType } from 'three/examples/jsm/controls/OrbitControls.js';
import { PcbDocument, SolderMaskColor, PcbDefectMarker, PcbMetadata } from '../../models/pcb.models';

const SOLDER_MASK_COLORS: Record<SolderMaskColor, number> = {
  GREEN: 0x165b2d,
  BLACK: 0x18181b,
  BLUE: 0x0c4a6e,
  RED: 0x7f1d1d,
  WHITE: 0xe2e8f0,
  YELLOW: 0x713f12
};

/** Mêmes couleurs que les marqueurs 2D : rouge / rose / bleu */
const SEVERITY_COLOR: Record<string, number> = {
  HIGH: 0xef4444,
  MEDIUM: 0xf97316,
  LOW: 0x3b82f6
};

@Injectable({
  providedIn: 'root'
})
export class Pcb3DRendererService {
  private scene!: ThreeNS.Scene;
  private camera!: ThreeNS.PerspectiveCamera;
  private renderer!: ThreeNS.WebGLRenderer;
  private controls!: OrbitControlsType;
  private animationFrameId: number | null = null;
  private pcbGroup: ThreeNS.Group | null = null;
  private currentDoc: PcbDocument | null = null;
  private themeObserver: MutationObserver | null = null;

  // ── Marqueurs de défauts DFM ──
  private markerGroup: ThreeNS.Group | null = null;
  private pulsingMeshes: ThreeNS.Mesh[] = [];
  private clock!: ThreeNS.Clock;

  /**
   * three.js, charge au premier passage en 3D.
   *
   * La bibliotheque pese plusieurs centaines de kilo-octets, et l'ecran les
   * imposait a tous ceux qui viennent seulement regarder leur carte en 2D —
   * avant meme le premier affichage. Elle n'arrive plus qu'au clic sur
   * l'onglet 3D.
   */
  private T!: typeof ThreeNS;
  private OrbitControlsCtor!: typeof OrbitControlsType;

  async init(container: HTMLElement): Promise<void> {
    if (!this.T) {
      const [three, orbit] = await Promise.all([
        import('three'),
        import('three/examples/jsm/controls/OrbitControls.js')
      ]);
      this.T = three;
      this.OrbitControlsCtor = orbit.OrbitControls;
      this.clock = new this.T.Clock();
    }

    const width = container.clientWidth || 800;
    const height = container.clientHeight || 550;

    // 1. Scene Studio adaptative (Light Studio #e2e8f0 / Dark #090d16)
    this.scene = new this.T.Scene();
    this.scene.background = new this.T.Color(this.getThemeBackgroundColor());

    // Observer les changements de mode Clair / Sombre
    this.setupThemeObserver();

    // 2. Camera
    this.camera = new this.T.PerspectiveCamera(40, width / height, 0.1, 2000);
    this.camera.position.set(0, -90, 110);

    // 3. Renderer
    this.renderer = new this.T.WebGLRenderer({ antialias: true, alpha: false });
    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = this.T.PCFSoftShadowMap;

    container.innerHTML = '';
    container.appendChild(this.renderer.domElement);

    // 4. OrbitControls
    this.controls = new this.OrbitControlsCtor(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.06;
    this.controls.maxDistance = 600;
    this.controls.minDistance = 20;

    // 5. Lighting
    this.setupLights();

    // 6. Animation Loop
    this.animate();
  }

  async renderPcb(doc: PcbDocument, color: SolderMaskColor = 'GREEN'): Promise<void> {
    if (!this.scene) return;
    this.currentDoc = doc;

    if (this.pcbGroup) {
      this.scene.remove(this.pcbGroup);
    }

    this.pcbGroup = new this.T.Group();

    const w = doc.metadata.widthMm || 80;
    const h = doc.metadata.heightMm || 60;
    const thickness = doc.metadata.thicknessMm || 1.6;

    // 1. Génération des textures haute résolution Top & Bottom depuis le SVG réel
    const [topTexture, bottomTexture] = await Promise.all([
      this.loadSvgTexture(doc.topSvg),
      this.loadSvgTexture(doc.bottomSvg)
    ]);

    const maskColorHex = SOLDER_MASK_COLORS[color] || SOLDER_MASK_COLORS.GREEN;

    // Matériau pour les tranches / bordures de la carte (FR4)
    const edgeMaterial = new this.T.MeshStandardMaterial({
      color: maskColorHex,
      roughness: 0.6,
      metalness: 0.1
    });

    // Matériau Face Supérieure (Top) avec le vrai dessin des pistes, vernis et sérigraphie
    const topMaterial = new this.T.MeshStandardMaterial({
      map: topTexture,
      color: topTexture ? 0xffffff : maskColorHex,
      roughness: 0.32,
      metalness: 0.22
    });

    // Matériau Face Inférieure (Bottom)
    const bottomMaterial = new this.T.MeshStandardMaterial({
      map: bottomTexture,
      color: bottomTexture ? 0xffffff : maskColorHex,
      roughness: 0.32,
      metalness: 0.22
    });

    // Configuration des 6 faces du BoxGeometry :
    // 0: +X, 1: -X, 2: +Y, 3: -Y, 4: +Z (Top), 5: -Z (Bottom)
    const materials: ThreeNS.Material[] = [
      edgeMaterial,
      edgeMaterial,
      edgeMaterial,
      edgeMaterial,
      topMaterial,
      bottomMaterial
    ];

    const pcbGeometry = new this.T.BoxGeometry(w, h, thickness);
    const pcbMesh = new this.T.Mesh(pcbGeometry, materials);
    pcbMesh.castShadow = true;
    pcbMesh.receiveShadow = true;
    this.pcbGroup.add(pcbMesh);

    // Centrage et ajustement caméra
    this.scene.add(this.pcbGroup);
    this.controls.target.set(0, 0, 0);
    const maxDim = Math.max(w, h);
    this.camera.position.set(0, -maxDim * 1.1, maxDim * 1.2);
    this.controls.update();
  }

  /**
   * Superpose les défauts DFM/DRC sur la carte 3D.
   * La carte est centrée en (0,0) : on ramène donc les coordonnées mm absolues
   * dans le repère local, et on pose la sphère sur la face concernée.
   */
  renderDefectMarkers(markers: PcbDefectMarker[], meta: PcbMetadata): void {
    if (!this.scene) return;

    // Toujours repartir d'un groupe propre (le polling DFM peut re-livrer la liste)
    if (this.markerGroup) {
      this.scene.remove(this.markerGroup);
      this.disposeGroup(this.markerGroup);
      this.markerGroup = null;
    }
    this.pulsingMeshes = [];

    if (!markers?.length) return;

    const w = meta.widthMm || 80;
    const h = meta.heightMm || 60;
    const thickness = meta.thicknessMm || 1.6;
    const radius = Math.max(0.35, Math.max(w, h) * 0.012);

    this.markerGroup = new this.T.Group();

    for (const marker of markers) {
      if (!Number.isFinite(marker.xMm) || !Number.isFinite(marker.yMm)) continue;

      const color = SEVERITY_COLOR[marker.severity] ?? SEVERITY_COLOR['LOW'];

      const localX = (marker.xMm - meta.minXMm) - w / 2;
      const localY = (marker.yMm - meta.minYMm) - h / 2;
      const localZ = marker.side === 'BOTTOM'
        ? -thickness / 2 - radius * 0.4
        : thickness / 2 + radius * 0.4;

      // Noyau opaque
      const core = new this.T.Mesh(
        new this.T.SphereGeometry(radius, 20, 20),
        new this.T.MeshStandardMaterial({
          color,
          emissive: color,
          emissiveIntensity: 0.65,
          roughness: 0.35,
          metalness: 0.1
        })
      );
      core.position.set(localX, localY, localZ);
      this.markerGroup.add(core);

      // Halo pulsant translucide
      const glow = new this.T.Mesh(
        new this.T.SphereGeometry(radius * 1.9, 20, 20),
        new this.T.MeshBasicMaterial({
          color,
          transparent: true,
          opacity: 0.24,
          depthWrite: false
        })
      );
      glow.position.set(localX, localY, localZ);
      this.markerGroup.add(glow);
      this.pulsingMeshes.push(glow);
    }

    this.scene.add(this.markerGroup);
  }

  private disposeGroup(group: ThreeNS.Group): void {
    group.traverse(obj => {
      const mesh = obj as ThreeNS.Mesh;
      if (mesh.geometry) mesh.geometry.dispose();
      if (mesh.material) {
        const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
        materials.forEach(m => m.dispose());
      }
    });
  }

  private getThemeBackgroundColor(): number {
    const isDark = typeof document !== 'undefined' && document.documentElement.classList.contains('dark');
    return isDark ? 0x090d16 : 0xe2e8f0; // Gris studio clair #e2e8f0 en Light Mode
  }

  private setupThemeObserver(): void {
    if (typeof document === 'undefined') return;
    if (this.themeObserver) this.themeObserver.disconnect();

    this.themeObserver = new MutationObserver(() => {
      if (this.scene) {
        this.scene.background = new this.T.Color(this.getThemeBackgroundColor());
      }
    });

    this.themeObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class']
    });
  }

  private loadSvgTexture(svgString?: string): Promise<ThreeNS.Texture | null> {
    if (!svgString) return Promise.resolve(null);

    return new Promise((resolve) => {
      const blob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const img = new Image();

      img.onload = () => {
        const canvas = document.createElement('canvas');
        const size = 2048;
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          // Fill with white first so drill holes & pad openings render white, not black
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(0, 0, size, size);
          ctx.drawImage(img, 0, 0, size, size);
        }
        URL.revokeObjectURL(url);

        const texture = new this.T.CanvasTexture(canvas);
        texture.colorSpace = this.T.SRGBColorSpace;
        texture.anisotropy = 16;
        texture.minFilter = this.T.LinearFilter;
        texture.magFilter = this.T.LinearFilter;
        texture.needsUpdate = true;
        resolve(texture);
      };

      img.onerror = () => {
        URL.revokeObjectURL(url);
        resolve(null);
      };

      img.src = url;
    });
  }

  updateColor(color: SolderMaskColor): void {
    if (this.currentDoc) {
      this.renderPcb(this.currentDoc, color);
    }
  }

  resize(width: number, height: number): void {
    if (!this.renderer || !this.camera) return;
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
  }

  resetView(): void {
    if (!this.controls || !this.camera || !this.currentDoc) return;
    const w = this.currentDoc.metadata.widthMm || 80;
    const h = this.currentDoc.metadata.heightMm || 60;
    const maxDim = Math.max(w, h);
    this.controls.reset();
    this.controls.target.set(0, 0, 0);
    this.camera.position.set(0, -maxDim * 1.1, maxDim * 1.2);
    this.controls.update();
  }

  destroy(): void {
    if (this.themeObserver) {
      this.themeObserver.disconnect();
      this.themeObserver = null;
    }
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
    }
    if (this.markerGroup) {
      this.scene?.remove(this.markerGroup);
      this.disposeGroup(this.markerGroup);
      this.markerGroup = null;
    }
    this.pulsingMeshes = [];
    if (this.renderer) {
      this.renderer.dispose();
    }
  }

  private setupLights(): void {
    // Lumière ambiante douce
    const ambientLight = new this.T.AmbientLight(0xffffff, 0.95);
    this.scene.add(ambientLight);

    // Lumière principale du dessus
    const dirLight1 = new this.T.DirectionalLight(0xffffff, 1.8);
    dirLight1.position.set(80, 120, 150);
    dirLight1.castShadow = true;
    this.scene.add(dirLight1);

    // Lumière de remplissage studio
    const dirLight2 = new this.T.DirectionalLight(0x90caf9, 0.8);
    dirLight2.position.set(-80, -120, -100);
    this.scene.add(dirLight2);

    // Lumière rasante pour faire briller les pastilles dorées
    const pointLight = new this.T.PointLight(0xffe082, 0.8, 400);
    pointLight.position.set(0, 0, 80);
    this.scene.add(pointLight);
  }

  private animate = (): void => {
    this.animationFrameId = requestAnimationFrame(this.animate);
    if (this.controls) {
      this.controls.update();
    }
    // Battement des halos de défauts, pour les repérer immédiatement
    if (this.pulsingMeshes.length) {
      const pulse = 1 + 0.35 * Math.sin(this.clock.getElapsedTime() * 4);
      for (const mesh of this.pulsingMeshes) {
        mesh.scale.set(pulse, pulse, pulse);
      }
    }
    if (this.renderer && this.scene && this.camera) {
      this.renderer.render(this.scene, this.camera);
    }
  };
}
