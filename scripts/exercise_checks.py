"""Learning feedback for the selected penguin exercises; not secure grading."""
def _tb_check(number, source):
    import ast
    import numpy as np
    import pandas as pd
    try:
        tree = ast.parse(source)
        nodes = list(ast.walk(tree))
        names = {n.id for n in nodes if isinstance(n, ast.Name) and isinstance(n.ctx, ast.Store)}
        required = {1:{'df'},2:{'missing'},3:{'clean'},4:set(),5:{'X','y'},6:{'X_train','X_test','y_train','y_test'},7:{'model','pred','score'},8:{'cm'}}
        if not required[number].issubset(names): return False
        scope = globals()
        expected = pd.read_csv('penguins_size.csv')
        cleaned = expected.dropna()
        cleaned = cleaned[cleaned['sex'].isin(['MALE','FEMALE'])]
        features = ['culmen_length_mm','culmen_depth_mm','flipper_length_mm','body_mass_g']
        calls = [n for n in nodes if isinstance(n, ast.Call)]
        call_name = lambda n: getattr(n.func,'attr',getattr(n.func,'id',''))
        if number == 1: return bool(scope['df'].equals(expected))
        if number == 2: return bool(scope['missing'].equals(expected.isna().sum()) and any(call_name(n) in ('isna','isnull') for n in calls))
        if number == 3: return bool(scope['clean'].equals(cleaned))
        if number == 4:
            plots = [n for n in calls if call_name(n)=='scatterplot']
            for plot in plots:
                kw = {k.arg:k.value for k in plot.keywords}
                if isinstance(kw.get('data'),ast.Name) and kw['data'].id=='clean' and isinstance(kw.get('x'),ast.Constant) and kw['x'].value=='flipper_length_mm' and isinstance(kw.get('y'),ast.Constant) and kw['y'].value=='body_mass_g' and isinstance(kw.get('hue'),ast.Constant) and kw['hue'].value=='species':
                    return bool(scope['clean'].equals(cleaned))
            return False
        if number == 5: return bool(scope['X'].equals(cleaned[features]) and scope['y'].equals(cleaned['species']))
        if number == 6:
            return bool(len(scope['X_train'])==len(scope['y_train'])==233 and len(scope['X_test'])==len(scope['y_test'])==100 and not set(scope['X_train'].index)&set(scope['X_test'].index) and any(call_name(n)=='train_test_split' for n in calls))
        if number == 7:
            from sklearn.tree import DecisionTreeClassifier
            from sklearn.metrics import accuracy_score
            return bool(isinstance(scope['model'],DecisionTreeClassifier) and any(call_name(n)=='fit' for n in calls) and np.array_equal(scope['pred'],scope['model'].predict(scope['X_test'])) and np.isclose(scope['score'],accuracy_score(scope['y_test'],scope['pred'])))
        if number == 8:
            from sklearn.metrics import confusion_matrix
            return bool(np.array_equal(scope['cm'],confusion_matrix(scope['y_test'],scope['pred'],labels=scope['labels'])) and np.asarray(scope['cm']).shape==(3,3) and int(np.asarray(scope['cm']).sum())==100 and any(call_name(n)=='heatmap' for n in calls))
    except Exception:
        return False
    return False
