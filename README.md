# STRIDE Requirement Classifier Prototype

This prototype implements the processing core for assigning STRIDE categories to requirements and requirement containers.

CSV Input (1. Row: ID; 2. Row: Afo Text)

## Interner Ablauf 
```bash
node src/index.js build --source tabelle1 (--with-context)
node src/index.js train --container tabelle1 --classifier svm --encoder jina-de
# Threshold (τ_l) (Cosine-Ähnlichkeit, kNN-Stimmanteil (z.b. 0.60: Mindestens 3/5 Nachbarn müssen positiv sein), Sigmoid-Abstand)
# Val-F1: Macro-F1 auf Validierungs-Split -> hoch gleich gut lernbar

# model= $(container)$(classifier)$(encoder).json
node src/index.js evaluate --model tabelle1.svm.jina-de 
# Support: Wie viele Anforderungen im Test-Split tragen dieses Label tatsächlich (Ground Truth)
# TP: True Positives – Classifier sagt Label, Label ist wirklich da
# FP: False Positives – Classifier sagt Label, aber Label gehört dort nicht hin
# FN: False Negatives – Classifier sagt Label nicht, obwohl es da sein sollte
# Precision: TP / (TP + FP) – Von allen vorhergesagten: wie viele waren richtig?
# Recall: TP / (TP + FN) = TP / Support – Von allen echten: wie viele wurden gefunden?
# F1: 2 × Prec × Rec / (Prec + Rec) – Harmonisches Mittel, balanciert Prec und Rec
```
## Externer Testlauf 
```bash
node src/index.js build --source tabelle2 
node src/index.js test --container tabelle2 --model tabelle1.svm.jina-de
node src/index.js test --container tabelle2 --rule-based 
```

## Classifier
```bash
node src/index.js classify --container tabelle --model tabelle1.svm.jina-de
node src/index.js classify --container tabelle --rule-based 
```
