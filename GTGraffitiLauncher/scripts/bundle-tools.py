#!/usr/bin/env python3
"""Relocate the tested local Node/FFmpeg toolchain into the app, including dylibs."""
import hashlib, pathlib, re, shutil, subprocess, sys
dest=pathlib.Path(sys.argv[1]);(dest/'bin').mkdir(parents=True,exist_ok=True);(dest/'lib').mkdir(exist_ok=True);(dest/'licenses').mkdir(exist_ok=True)
mapping={};pending=[]
def dependencies(file):
 return sorted(set(line.strip().split(' (compatibility')[0] for line in subprocess.check_output(['/usr/bin/otool','-L',str(file)],text=True).splitlines() if line.startswith('\t') and ' (compatibility' in line))
def resolve_dependency(source,dependency):
 if dependency.startswith('@loader_path/'):
  return (source.parent/dependency.removeprefix('@loader_path/')).resolve()
 if dependency.startswith('@rpath/'):
  tail=dependency.removeprefix('@rpath/');lines=subprocess.check_output(['/usr/bin/otool','-l',str(source)],text=True).splitlines();paths=[source.parent,pathlib.Path('/opt/homebrew/lib')]
  for i,line in enumerate(lines):
   if line.strip()=='cmd LC_RPATH':
    for nextline in lines[i+1:i+4]:
     match=re.search(r'path (.+) \(offset',nextline)
     if match:paths.append(pathlib.Path(match.group(1).replace('@loader_path',str(source.parent))))
  for directory in paths:
   candidate=directory/tail
   if candidate.exists():return candidate.resolve()
  raise RuntimeError(f'Cannot relocate dependency {dependency} from {source}')
 if dependency.startswith('/opt/homebrew/') or dependency.startswith('/usr/local/'):return pathlib.Path(dependency).resolve()
 return None
def add(source,target=None):
 source=pathlib.Path(source).resolve()
 if source in mapping:return mapping[source]
 if target is None:target=dest/'lib'/(source.stem+'-'+hashlib.sha256(str(source).encode()).hexdigest()[:8]+source.suffix)
 shutil.copy2(source,target);target.chmod(0o755);mapping[source]=target;pending.append(source);return target
for name in ['node','ffmpeg','ffprobe']:
 source=shutil.which(name)
 if not source:raise SystemExit(f'Build prerequisite missing: {name}')
 add(source,dest/'bin'/name)
while pending:
 source=pending.pop()
 for dependency in dependencies(source):
  resolved=resolve_dependency(source,dependency)
  if resolved is not None:add(resolved)
for source,target in mapping.items():
 subprocess.run(['/usr/bin/codesign','--remove-signature',str(target)],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
 changes=[]
 for dependency in dependencies(source):
  original=resolve_dependency(source,dependency)
  if original in mapping:changes+=['-change',dependency,'@rpath/'+mapping[original].name]
 if target.parent.name=='lib':changes+=['-id','@rpath/'+target.name]
 rpath='@loader_path' if target.parent.name=='lib' else '@loader_path/../lib'
 subprocess.run(['/usr/bin/install_name_tool',*changes,'-add_rpath',rpath,str(target)],check=True,stdout=subprocess.DEVNULL)
 subprocess.run(['/usr/bin/codesign','--force','--sign','-',str(target)],check=True,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
shutil.copy2(pathlib.Path(__file__).with_name('NODE-LICENSE.txt'),dest/'licenses'/'node.txt')
for name,args in [('ffmpeg',['-L']),('ffprobe',['-L'])]:
 result=subprocess.run([str(dest/'bin'/name),*args],text=True,capture_output=True);
 if result.returncode:raise RuntimeError(result.stderr)
 (dest/'licenses'/(name+'.txt')).write_text(result.stdout+result.stderr)
formulae=set()
for source in mapping:
 match=re.search(r'(.*/Cellar/[^/]+/[^/]+)',str(source))
 if match:formulae.add(pathlib.Path(match.group(1)))
for formula in formulae:
 for file in formula.rglob('*'):
  if file.is_file() and re.match(r'^(licen[cs]e|copying|copyright)',file.name,re.I) and file.stat().st_size<2000000:
   target=dest/'licenses'/formula.parent.name/file.relative_to(formula);target.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(file,target)
(dest/'licenses'/'TOOLCHAIN.txt').write_text('Bundled from the tested local toolchain. FFmpeg is GPL-enabled; see ffmpeg.txt and corresponding upstream sources at https://ffmpeg.org/releases/ffmpeg-7.1.tar.xz. Node source: https://nodejs.org/dist/. Dependencies and original paths:\n'+'\n'.join(str(s) for s in mapping))
for name,version in [('node','--version'),('ffmpeg','-version'),('ffprobe','-version')]:
 subprocess.run([str(dest/'bin'/name),version],check=True,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL,env={'PATH':'/usr/bin:/bin'})
print(f'Bundled and verified {len(mapping)} executables/libraries without Homebrew runtime lookup.')
