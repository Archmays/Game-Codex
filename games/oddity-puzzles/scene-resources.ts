import * as T from 'three';
/** GLTF clones borrow textures. Render targets exclusively own their attachments. */
export function disposeOddityTree(root: T.Object3D, replaced: Iterable<T.Material> = [], portraits: Iterable<T.Texture> = [], targets: T.WebGLRenderTarget[] = []) {
    const geometries = new Set<T.BufferGeometry>(), materials = new Set<T.Material>(replaced), textures = new Set<T.Texture>(portraits);
    root.traverse(o => {
        if (o instanceof T.Mesh || o instanceof T.Line || o instanceof T.Points) {
            geometries.add(o.geometry);
            for (const m of Array.isArray(o.material) ? o.material : [o.material])
                materials.add(m);
        }
        if (o instanceof T.DirectionalLight || o instanceof T.PointLight || o instanceof T.SpotLight)
            o.shadow.dispose();
    });
    for (const m of materials)
        for (const value of Object.values(m))
            if (value instanceof T.Texture)
                textures.add(value);
    for (const target of targets)
        textures.delete(target.texture);
    geometries.forEach(g => g.dispose());
    materials.forEach(m => m.dispose());
    textures.forEach(t => t.dispose());
    targets.forEach(t => t.dispose());
}
