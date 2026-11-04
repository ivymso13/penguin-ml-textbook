"""Check correct work, plausible wrong work and stale-state false positives."""
from pathlib import Path
import json,runpy,os,contextlib,io
ROOT=Path(__file__).resolve().parents[1]
os.environ.setdefault('MPLCONFIGDIR',str(ROOT/'artifacts/matplotlib-cache'))
os.environ.setdefault('MPLBACKEND','Agg')
loaded=runpy.run_path(str(ROOT/'scripts/exercise_checks.py'));scope=loaded['_tb_check'].__globals__
exec('import pandas as pd\nimport seaborn as sns\nimport matplotlib.pyplot as plt\nfrom sklearn.model_selection import train_test_split\nfrom sklearn.tree import DecisionTreeClassifier\nfrom sklearn.metrics import accuracy_score,confusion_matrix',scope)
solutions=json.loads((ROOT/'artifacts/teacher-solutions.json').read_text())
prior=os.getcwd();os.chdir(ROOT/'content')
try:
    with contextlib.redirect_stdout(io.StringIO()):
        for number in range(1,9):
            solution=solutions[str(number)];exec(solution,scope)
            assert scope['_tb_check'](number,solution),f'Valid mission {number} rejected'
            assert not scope['_tb_check'](number,"print('old variables exist')"),f'Stale state passed {number}'
        wrong=solutions['3'].replace('clean[clean["sex"].isin(["MALE", "FEMALE"])]','clean')
        exec(wrong,scope);assert not scope['_tb_check'](3,wrong)
        exec(solutions['3'],scope)
        wrong=solutions['5'].replace('y = clean["species"]','y = clean["island"]')
        exec(wrong,scope);assert not scope['_tb_check'](5,wrong)
        exec(solutions['5'],scope)
        wrong=solutions['6'].replace('test_size=0.3','test_size=0.2')
        exec(wrong,scope);assert not scope['_tb_check'](6,wrong)
        exec(solutions['6'],scope)
        exec(solutions['7'],scope)
        wrong=solutions['8'].replace('confusion_matrix(y_test, pred, labels=labels)','confusion_matrix(y_test, y_test, labels=labels)')
        exec(wrong,scope);assert not scope['_tb_check'](8,wrong)
    print('PASS: 8 missions, stale-state rejection, invalid category retained, wrong target/split/confusion matrix')
finally:os.chdir(prior)
