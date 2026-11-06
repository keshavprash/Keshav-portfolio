/* Releases every GPU resource held by a scene graph. */
export function disposeTree(root) {
  const materials = new Set();
  const geometries = new Set();
  root.traverse((o) => {
    if (o.geometry) geometries.add(o.geometry);
    if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) => materials.add(m));
    if (o.isInstancedMesh && o.dispose) o.dispose();
  });
  geometries.forEach((g) => g.dispose());
  materials.forEach((m) => {
    Object.values(m).forEach((v) => { if (v && v.isTexture) v.dispose(); });
    if (m.uniforms) Object.values(m.uniforms).forEach((u) => { if (u.value && u.value.isTexture) u.value.dispose(); });
    m.dispose();
  });
  return { geometries: geometries.size, materials: materials.size };
}
