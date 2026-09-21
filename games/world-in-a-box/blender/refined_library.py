"""Append editable canonical collections. Never regenerate the authoring library."""
import bpy
from pathlib import Path

def install(mapping):
 path=Path(__file__).parent/'refined-models.blend'
 if not path.is_file():raise RuntimeError('Missing refined-models.blend; export must not fall back to coarse geometry')
 # Remove replaced children first so compatible animation/pivot names are exact.
 for source,target in mapping.items():
  if target:
   if target not in bpy.data.objects:raise RuntimeError('Missing integration root '+target)
   for o in list(bpy.data.objects[target].children_recursive):bpy.data.objects.remove(o,do_unlink=True)
 with bpy.data.libraries.load(str(path),link=False) as (src,dst):dst.objects=list(src.objects)
 objects=[o for o in dst.objects if o]
 roots={o.name:o for o in objects if o.parent is None}
 retained=set()
 for name,target in mapping.items():
  if name not in roots:raise RuntimeError('Missing refined asset '+name)
  r=roots[name];members=[r]+list(r.children_recursive);retained.update(members)
  for o in members:bpy.context.collection.objects.link(o)
  if target:
   destination=bpy.data.objects[target]
   for child in list(r.children):child.parent=destination
   retained.discard(r);objects.remove(r);bpy.data.objects.remove(r,do_unlink=True)
 for o in objects:
  if o not in retained and o.name in bpy.data.objects:bpy.data.objects.remove(o,do_unlink=True)
 return path
