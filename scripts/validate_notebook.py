"""Execute a solution-filled copy; keep the downloadable student notebook blank."""
from pathlib import Path
import os,json,base64
ROOT=Path(__file__).resolve().parents[1]
os.environ.setdefault('MPLCONFIGDIR',str(ROOT/'artifacts/matplotlib-cache'))
import nbformat
from nbclient import NotebookClient
nb=nbformat.read(ROOT/'content/01-penguins.ipynb',as_version=4)
nbformat.validate(nb)
assert sum('practice' in c.metadata.get('tags',[]) for c in nb.cells)==8
assert sum('followup' in c.metadata.get('tags',[]) for c in nb.cells)==16
assert all(not c.get('outputs') for c in nb.cells if c.cell_type=='code')
solutions=json.loads((ROOT/'artifacts/teacher-solutions.json').read_text())
for cell in nb.cells:
    if 'practice' in cell.metadata.get('tags',[]):
        assert '___' in cell.source
        cell.source=solutions[str(cell.metadata.lesson_step)]
nb.cells.append(nbformat.v4.new_code_cell((ROOT/'scripts/exercise_checks.py').read_text()+ '\n'+
    '\n'.join(f'assert _tb_check({i}, {solution!r}), "mission {i}"' for i,solution in ((int(i),s) for i,s in solutions.items()))+'''
assert df.shape == (344,7)
assert len(clean) == 333
assert clean.isna().sum().sum() == 0
assert set(clean['sex']) == {'MALE','FEMALE'}
assert X.shape == (333,4)
assert len(X_train)==233 and len(X_test)==100
assert cm.shape==(3,3) and cm.sum()==100
assert 0<=score<=1
print('PASS: 8 solutions, preprocessing, shared state, split, model and confusion matrix')
'''))
NotebookClient(nb,timeout=180,kernel_name='python3',resources={'metadata':{'path':str(ROOT/'content')}}).execute()
output=ROOT/'artifacts';output.mkdir(exist_ok=True)
nbformat.write(nb,output/'penguins-validated.ipynb')
figures=0
for cell in nb.cells:
    for out in cell.get('outputs',[]):
        png=out.get('data',{}).get('image/png')
        if png:
            if isinstance(png,list):png=''.join(png)
            (output/f'penguins-step-{cell.metadata.get("lesson_step","other")}.png').write_bytes(base64.b64decode(png));figures+=1
        if out.output_type=='stream' and ('PASS:' in out.text or 'accuracy' in out.text or '정확도' in out.text):print(out.text.strip())
assert figures>=2, f'Expected scatterplot and confusion matrix; got {figures}'
print(f'PASS: {figures} rendered figures saved for inspection')
