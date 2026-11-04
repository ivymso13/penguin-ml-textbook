"""Build the penguin textbook and notebook from the user's supplied lesson."""
from pathlib import Path
import json
import nbformat as nbf
from dataset_intro import build_dataset_intro
from course_penguins import STEPS

ROOT=Path(__file__).resolve().parents[1]
data, data_markdown=build_dataset_intro(ROOT)
imports='''import pandas as pd
import matplotlib.pyplot as plt
import seaborn as sns
from sklearn.model_selection import train_test_split
from sklearn.tree import DecisionTreeClassifier
from sklearn.metrics import accuracy_score, confusion_matrix
from IPython import get_ipython
if get_ipython() is not None:
    get_ipython().run_line_magic("matplotlib", "inline")
sns.set_theme(style="whitegrid")
plt.rcParams.update({"figure.dpi": 100, "font.size": 10})'''
setup='''import sys
if sys.platform == "emscripten":
    import piplite
    await piplite.install(["pandas", "matplotlib", "seaborn", "scikit-learn"])
'''+imports
runtime=setup+'''
from pyodide.http import pyfetch
from pathlib import Path
_tb_response = await pyfetch(__DATA_URL__)
if not _tb_response.ok:
    raise RuntimeError("수업 CSV를 불러오지 못했습니다.")
Path("penguins_size.csv").write_text(await _tb_response.string(), encoding="utf-8")
'''+(ROOT/'scripts/exercise_checks.py').read_text()
lesson=dict(id='penguins-classification-v1',legacyIds=[],title='몸의 특징으로 펭귄의 종을 구분할 수 있을까?',
    notebookFile='01-penguins.ipynb',exportFile='my-penguins-practice.ipynb',dataset=data,runtimeSetup=runtime,
    referenceNotebook='기계학습과_데이터_분류(공유용).ipynb',steps=[])
lesson['quizRevision']=json.loads((ROOT/'scripts/quiz_questions.json').read_text())['revision']
cells=[nbf.v4.new_markdown_cell('''# 펭귄 데이터로 배우는 기계학습 분류

설명 → 코드 완성 → 결과에서 이어지는 꼬리질문 → 자유 실험을 반복합니다.
원자료의 핵심 과정을 8개의 실습으로 골랐습니다. 약 45~60분이며 수업 상황에 따라 나누어 진행할 수 있습니다.

`___`를 직접 채우고 위에서 아래로 실행하세요. 코드 바로 뒤 질문은 방금 관찰한 결과를 근거로 답합니다.
서술형은 예시 답안과 스스로 비교하는 연습이며 자동 정오 판정을 하지 않습니다.
'''),nbf.v4.new_markdown_cell(data_markdown),nbf.v4.new_markdown_cell('## 실행 준비\nCSV를 이 노트북과 같은 폴더에 두고 아래 셀을 먼저 실행하세요. 브라우저 교재에서는 파일이 자동 준비됩니다.'),
nbf.v4.new_code_cell(setup,metadata={'tags':['setup']})]
for number, raw in enumerate(STEPS,1):
    step={k:v for k,v in raw.items() if k not in ('solution','starter')}
    step.update(id=number,code=raw['starter'])
    lesson['steps'].append(step)
    cells.append(nbf.v4.new_markdown_cell(f"## {number:02d}. {raw['title']}\n\n{raw['explanation']}\n\n**코드 완성 미션:** {raw['goal']}\n\n<details><summary>작성 힌트</summary>{raw['codingHint']}</details>"))
    cells.append(nbf.v4.new_code_cell(raw['starter'],metadata={'tags':['practice'],'lesson_step':number}))
    for q in raw['questions']:
        options='\n'.join(f"- {o}" for o in q.get('options',[]))
        experiment=f"\n\n자유 실험 셀에서 확인할 코드:\n\n```python\n{q['tryCode']}\n```" if q.get('tryCode') else ''
        rubric='\n\n자기점검:\n'+ '\n'.join(f'- [ ] {item}' for item in q['rubric']) if q.get('rubric') else ''
        cells.append(nbf.v4.new_markdown_cell(f"### 질문 {raw['questions'].index(q)+1}\n\n**{q['prompt']}**\n\n{q['context']}\n\n{options}{experiment}\n\n내 답: \n\n<details><summary>답을 작성한 뒤 해설과 비교</summary>{q['feedback']}</details>{rubric}",metadata={'tags':['followup'],'question_id':q['id']}))
    cells.append(nbf.v4.new_markdown_cell('**자유 실험:** 아래 셀에서 값을 바꾸거나 새 코드를 작성해 보세요. 앞에서 만든 변수를 함께 사용합니다.'))
    cells.append(nbf.v4.new_code_cell('',metadata={'tags':['sandbox'],'lesson_step':number,'sandbox_id':f'blank-{number}'}))
cells.append(nbf.v4.new_markdown_cell('''## 내 말로 정리하기

1. 결측치와 잘못된 표기는 어떻게 다른가요? →
2. 산점도에서 본 특징과 모델의 분류 결과를 연결해 설명해 보세요. →
3. 평가용 정확도와 혼동행렬은 각각 무엇을 알려 주나요? →

**더 해보기:** 7단계의 max_depth를 바꾸고 7→8을 다시 실행해 비교하세요.
**생략한 과정:** 반복 countplot·boxplot·regplot·상관관계 히트맵·MinMax 정규화·나무 시각화.
원본 자료와 CSV는 reference 폴더에 보존합니다. 실제 수업 데이터의 출처는 원본 노트북에 기재된 Kaggle 링크를 따릅니다.
'''))
for i,c in enumerate(cells): c.id=f'penguins-{i:02d}'
nb=nbf.v4.new_notebook(cells=cells,metadata={'kernelspec':{'display_name':'Python (Pyodide)','language':'python','name':'python'},'language_info':{'name':'python'},'title':lesson['title'],'quiz_revision':lesson['quizRevision']})
nbf.validate(nb)
nbf.write(nb,ROOT/'content/01-penguins.ipynb')
(ROOT/'web/lesson.json').write_text(json.dumps(lesson,ensure_ascii=False,indent=2)+'\n')
(ROOT/'artifacts').mkdir(exist_ok=True)
(ROOT/'artifacts/teacher-solutions.json').write_text(json.dumps({str(i):s['solution'] for i,s in enumerate(STEPS,1)},ensure_ascii=False,indent=2))
print(f'Built penguin lesson: {len(STEPS)} exercises, {sum(len(s["questions"]) for s in STEPS)} follow-up questions, {len(cells)} notebook cells')
