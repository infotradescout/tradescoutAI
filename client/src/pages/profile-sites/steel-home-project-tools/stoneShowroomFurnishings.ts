import * as THREE from "three";
import { getStoneShowroomRoom } from "./stoneShowroom";
import type { CountertopPlannerDesign } from "./countertopPlannerModel";

/** Decorative example furniture belongs only to the explicitly labeled showroom scene. */
export function addStoneShowroomFurnishings(parent: THREE.Group, design: CountertopPlannerDesign) {
  const room = getStoneShowroomRoom(design.room);
  const width = design.wallAIn / 12;
  const depth = design.wallDepthIn / 12;
  const top = (design.finishedTopHeightIn ?? 36) / 12 - (design.topThicknessIn ?? 1.25) / 12;
  const wood = room === "bathroom" ? "#87634a" : room === "living" ? "#654b39" : "#ad8c67";
  const box = (
    size: [number, number, number],
    pos: [number, number, number],
    color: string,
    metalness = 0
  ) => {
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(...size),
      new THREE.MeshStandardMaterial({ color, roughness: metalness ? 0.3 : 0.74, metalness })
    );
    mesh.position.set(...pos);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    parent.add(mesh);
    return mesh;
  };
  const cylinder = (
    radius: number,
    height: number,
    pos: [number, number, number],
    color: string
  ) => {
    const mesh = new THREE.Mesh(
      new THREE.CylinderGeometry(radius, radius, height, 32),
      new THREE.MeshStandardMaterial({ color, roughness: 0.65 })
    );
    mesh.position.set(...pos);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    parent.add(mesh);
    return mesh;
  };
  const cabinets = (w: number, d: number, x: number, z: number, floating: boolean) => {
    const bottom = floating ? 0.8 : 0.3;
    const height = top - bottom;
    box([w - 0.15, height, d - 0.18], [x, bottom + height / 2, z], wood);
    if (!floating) box([w - 0.4, 0.28, d - 0.4], [x, 0.14, z], "#3c332c");
    const doors = Math.max(2, Math.round(w / 1.7));
    const doorW = (w - 0.18) / doors;
    for (let i = 0; i < doors; i++) {
      const doorX = x - (w - 0.18) / 2 + doorW * (i + 0.5);
      box(
        [doorW - 0.035, height - 0.06, 0.05],
        [doorX, bottom + height / 2, z + d / 2 - 0.065],
        wood
      );
      box([0.36, 0.025, 0.055], [doorX, top - 0.22, z + d / 2 - 0.025], "#b59b65", 0.8);
      // Fine vertical grooves give the timber fronts depth without external textures.
      for (let j = 1; j < 7; j++)
        box(
          [0.009, height - 0.12, 0.009],
          [doorX - doorW / 2 + (doorW * j) / 7, bottom + height / 2, z + d / 2 - 0.036],
          "#76614b"
        );
    }
  };
  cabinets(width, depth, 0, depth / 2, room !== "kitchen");
  if (room === "kitchen") {
    const islandX =
      -width / 2 + (design.islandLeftOffsetIn ?? 30) / 12 + design.islandLengthIn / 24;
    const islandZ = (design.islandBackOffsetIn ?? 72) / 12 + design.islandWidthIn / 24;
    cabinets(
      design.islandLengthIn / 12 - 0.4,
      design.islandWidthIn / 12 - 0.6,
      islandX,
      islandZ,
      false
    );
    for (const x of [-2.2, 0, 2.2]) {
      cylinder(0.48, 0.16, [islandX + x, 2.1, islandZ + 2.4], "#d9c8ad");
      for (const dx of [-0.28, 0.28])
        for (const dz of [-0.28, 0.28])
          cylinder(0.035, 2.0, [islandX + x + dx, 1.05, islandZ + 2.4 + dz], "#3e3932");
    }
    for (const x of [-2.1, 2.1]) {
      cylinder(0.014, 1.5, [islandX + x, 8.2, islandZ], "#4a4032");
      const shade = new THREE.Mesh(
        new THREE.ConeGeometry(0.65, 0.55, 40, 1, true),
        new THREE.MeshStandardMaterial({
          color: "#b39158",
          roughness: 0.35,
          metalness: 0.6,
          side: THREE.DoubleSide,
        })
      );
      shade.position.set(islandX + x, 7.2, islandZ);
      parent.add(shade);
      cylinder(0.5, 0.025, [islandX + x, 6.94, islandZ], "#ffeed0");
    }
    // A tall side pantry and open shelf frame the countertop, leaving the stone visible.
    box([1.35, 7.8, 2], [-width / 2 - 1, 3.9, 1], "#b7a285");
    box([5.6, 0.12, 0.7], [1.7, 6.7, 0.38], wood);
    cylinder(0.22, 0.55, [3.3, 7.04, 0.4], "#c9b8a0");
  } else if (room === "bathroom") {
    for (const x of [-1.9, 1.9]) {
      const frame = cylinder(1.05, 0.08, [x, 5.55, 0.12], "#b49a65");
      frame.rotation.x = Math.PI / 2;
      const mirror = cylinder(0.98, 0.025, [x, 5.55, 0.18], "#b7c5c1");
      mirror.rotation.x = Math.PI / 2;
      box([0.08, 1.4, 0.12], [x + 1.2, 5.55, 0.22], "#f8e8c5");
    }
    box([2.0, 0.16, 1.0], [2.6, top + 0.2, 1.4], "#d8d2c6");
    box([1.7, 0.13, 0.9], [2.6, top + 0.34, 1.4], "#eee9df");
    box([3.6, 0.025, 2], [0, 0.01, 5.3], "#cdc2ad");
  } else {
    box([6.9, 3.2, 0.18], [0, 5.3, 0.15], "#2f322e");
    box([6.6, 2.9, 0.03], [0, 5.3, 0.26], "#b8b5a4");
    box([3.8, 2.1, 0.04], [-0.7, 5.25, 0.29], "#7e8c7b");
    box([6.2, 0.04, 4.7], [1, 0.01, 8.7], "#e3d9c7");
    box([6.1, 1.2, 2.6], [1, 0.95, 10.8], "#d7c7b4");
    box([6.3, 1.55, 0.45], [1, 1.72, 11.9], "#cbbca8");
    for (const x of [-1.7, 3.7]) box([0.5, 0.8, 2.7], [x, 1.6, 10.8], "#cbbca8");
    for (const x of [-0.9, 1, 2.9]) box([1.8, 0.35, 2.0], [x, 1.65, 10.65], "#e6d8c5");
    cylinder(1.15, 0.14, [1, 1.3, 7.6], "#735b44");
    cylinder(0.55, 1.2, [1, 0.65, 7.6], "#735b44");
  }
  // Window reveal, glazing and mullions; intentionally decorative, never a measured opening.
  const windowX = -(design.roomWidthIn ?? 192) / 24 + 0.12;
  box([0.12, 3.8, 3.6], [windowX, 5.9, 5.2], "#c2b9a8");
  const glass = box([0.13, 3.55, 3.35], [windowX + 0.02, 5.9, 5.2], "#c4dad7");
  (glass.material as THREE.MeshStandardMaterial).emissive.set("#8ca9a3");
  (glass.material as THREE.MeshStandardMaterial).emissiveIntensity = 0.3;
  box([0.15, 0.06, 3.35], [windowX + 0.04, 5.9, 5.2], "#f1ece0");
  box([0.15, 3.55, 0.06], [windowX + 0.04, 5.9, 5.2], "#f1ece0");
  // A quiet plant provides depth and a recognizable scale reference.
  const plantX = width / 2 + 0.65;
  cylinder(0.38, 0.8, [plantX, 0.4, 1], "#b7a38b");
  for (let i = 0; i < 7; i++) {
    const leaf = new THREE.Mesh(
      new THREE.SphereGeometry(0.34, 12, 10),
      new THREE.MeshStandardMaterial({ color: i % 2 ? "#64735b" : "#849275", roughness: 0.9 })
    );
    leaf.scale.set(0.55, 2.1, 1);
    leaf.rotation.z = (i - 3) * 0.22;
    leaf.position.set(plantX + Math.sin(i * 2) * 0.27, 1.3 + i * 0.11, 1 + Math.cos(i * 2) * 0.2);
    leaf.castShadow = true;
    parent.add(leaf);
  }
  if (!design.floorStone) {
    const roomWidth = (design.roomWidthIn ?? 192) / 12;
    const roomDepth = (design.roomDepthIn ?? 168) / 12;
    for (let z = 0.65; z < roomDepth; z += 0.65)
      box([roomWidth, 0.006, 0.014], [0, -0.015, z], "#bba98c");
  }
}
