"""Run in Blender's Python context, with optional `args` supplied by the bridge.

Exports this pack's root hierarchies using temporary scene/data copies. Source
geometry, materials, packed images, transforms, and selection remain untouched.
"""
import bpy
import json
from pathlib import Path
from mathutils import Vector

OPTIONS = globals().get('args', {})
OUTPUT = Path(OPTIONS.get('output', str(Path(bpy.data.filepath).parent / 'web-exports')))
MAX_TEXTURE = int(OPTIONS.get('max_texture', 1024))
NAMES = ['clarinet', 'flute', 'horn', 'oboe', 'double-bass', 'snare-drum',
         'timpani', 'trombone', 'trumpet', 'tuba', 'bassoon', 'cello']


def triangles(objects):
    total = 0
    for obj in objects:
        if obj.type == 'MESH':
            obj.data.calc_loop_triangles()
            total += len(obj.data.loop_triangles)
    return total


def export_instrument(index, name):
    root_name = 'Sketchfab_model' + (f'.{index:03}' if index else '')
    root = bpy.context.scene.objects[root_name]
    originals = [root] + list(root.children_recursive)
    source_triangles = triangles(originals)
    scene = bpy.data.scenes.new('Instrument export temporary')
    objects, meshes, materials, images = [], [], {}, {}
    previous_scene = bpy.context.window.scene
    try:
        mapping = {}
        for original in originals:
            copy = original.copy()
            if original.type == 'MESH':
                copy.data = original.data.copy()
                meshes.append(copy.data)
            scene.collection.objects.link(copy)
            objects.append(copy)
            mapping[original] = copy
        for original, copy in mapping.items():
            copy.parent = mapping.get(original.parent)
            copy.matrix_world = original.matrix_world.copy()
        bpy.context.window.scene = scene
        bpy.context.view_layer.update()
        points = [o.matrix_world @ Vector(c) for o in objects if o.type == 'MESH' for c in o.bound_box]
        center = Vector([(min(p[i] for p in points) + max(p[i] for p in points)) / 2 for i in range(3)])
        mapping[root].location -= center
        for obj in objects:
            if obj.type != 'MESH':
                continue
            for slot in obj.material_slots:
                material = slot.material
                if material is None:
                    continue
                if material not in materials:
                    duplicate = material.copy()
                    materials[material] = duplicate
                    if duplicate.use_nodes:
                        for node in duplicate.node_tree.nodes:
                            if node.type != 'TEX_IMAGE' or not node.image:
                                continue
                            image = node.image
                            if image not in images:
                                resized = image.copy()
                                images[image] = resized
                                width, height = resized.size
                                if max(width, height) > MAX_TEXTURE:
                                    factor = MAX_TEXTURE / max(width, height)
                                    resized.scale(max(1, round(width * factor)), max(1, round(height * factor)))
                            node.image = images[image]
                slot.material = materials[material]
        # Decimation is opt-in: anatomy and silhouettes need visual approval.
        ratio = float(OPTIONS.get('oboe_ratio', 1.0)) if name == 'oboe' else 1.0
        if ratio < 1:
            for obj in objects:
                if obj.type == 'MESH' and len(obj.data.polygons) > 1000:
                    bpy.context.view_layer.objects.active = obj
                    modifier = obj.modifiers.new('Web candidate reduction', 'DECIMATE')
                    modifier.ratio = ratio
                    bpy.ops.object.modifier_apply(modifier=modifier.name)
        destination = OUTPUT / name / f'{name}.glb'
        destination.parent.mkdir(parents=True, exist_ok=True)
        if destination.exists():
            raise FileExistsError(f'Refusing to overwrite {destination}')
        bpy.ops.export_scene.gltf(filepath=str(destination), export_format='GLB',
            use_selection=False, use_active_scene=True, export_animations=False, export_cameras=False,
            export_lights=False, export_image_format='AUTO', export_image_quality=85,
            export_texcoords=True, export_normals=True, export_apply=True,
            export_draco_mesh_compression_enable=False)
        return {'instrument': name, 'source_root': root_name, 'source_triangles': source_triangles,
                'export_triangles': triangles(objects), 'meshes': len(meshes),
                'materials': len(materials), 'textures': len(images),
                'bytes': destination.stat().st_size, 'file': str(destination),
                'geometry_ratio': ratio, 'rights_status': 'requires human review',
                'visual_status': 'requires visual review'}
    finally:
        bpy.context.window.scene = previous_scene
        for obj in objects:
            bpy.data.objects.remove(obj, do_unlink=True)
        bpy.data.scenes.remove(scene)
        for mesh in meshes:
            if mesh.users == 0:
                bpy.data.meshes.remove(mesh)
        for material in materials.values():
            bpy.data.materials.remove(material)
        for image in images.values():
            bpy.data.images.remove(image)


OUTPUT.mkdir(parents=True, exist_ok=True)
manifest = OUTPUT / 'manifest.json'
report = json.loads(manifest.read_text()) if manifest.exists() else {
    'source_blend': bpy.data.filepath, 'max_texture': MAX_TEXTURE, 'instruments': []}
if report['source_blend'] != bpy.data.filepath or report['max_texture'] != MAX_TEXTURE:
    raise ValueError('Existing manifest belongs to a different source or texture setting')
for index, name in enumerate(NAMES):
    if globals().get('__cancel_event__') and __cancel_event__.is_set():
        break
    if name not in OPTIONS.get('instruments', NAMES):
        continue
    report['instruments'].append(export_instrument(index, name))
    manifest.write_text(json.dumps(report, indent=2))
__result__ = report
