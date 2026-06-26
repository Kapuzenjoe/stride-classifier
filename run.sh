#!/bin/bash
set -e

mkdir -p data/results
exec > >(tee "data/results/run_$(date +%Y%m%d_%H%M%S).log") 2>&1

ENCODERS=(jina-de e5-large bge-m3)
CLASSIFIERS=(svm knn centroid)

# ── 1. Container bauen (5: tabelle1/2/3 + tabelle1.ctx + tabelle3.ctx) ──
echo "=========================================="
echo "Build: Container"
echo "=========================================="
node src/index.js build --source tabelle1
node src/index.js build --source tabelle2
node src/index.js build --source tabelle3
node src/index.js build --source tabelle1 --with-context
node src/index.js build --source tabelle3 --with-context

# ── 2. Training: tabelle1, tabelle1.ctx, dann tabelle1+ndd, je 9 Encoder/Classifier-Kombos ──
echo "=========================================="
echo "Train: tabelle1, tabelle1.ctx & tabelle1+ndd (9 Kombos je Variante = 27 Modelle)"
echo "=========================================="
for CONTAINER in tabelle1 tabelle1.ctx; do
  for CLASSIFIER in "${CLASSIFIERS[@]}"; do
    for ENCODER in "${ENCODERS[@]}"; do
      echo "------------------------------------------"
      echo "Training: $CONTAINER / $CLASSIFIER / $ENCODER"
      echo "------------------------------------------"
      node src/index.js train --container "$CONTAINER" --classifier "$CLASSIFIER" --encoder "$ENCODER"
    done
  done
done

for CLASSIFIER in "${CLASSIFIERS[@]}"; do
  for ENCODER in "${ENCODERS[@]}"; do
    echo "------------------------------------------"
    echo "Training: tabelle1 / $CLASSIFIER / $ENCODER (--ndd)"
    echo "------------------------------------------"
    node src/index.js train --container tabelle1 --classifier "$CLASSIFIER" --encoder "$ENCODER" --ndd
  done
done

# ── 3. Interne Evaluation: alle 27 trainierten Modelle + Rule-Based auf tabelle1 ──
echo "=========================================="
echo "Evaluate: interner Test-Split (27 Modelle + Rule-Based)"
echo "=========================================="
TRAINED_MODELS=()
for CONTAINER in tabelle1 tabelle1.ctx; do
  for CLASSIFIER in "${CLASSIFIERS[@]}"; do
    for ENCODER in "${ENCODERS[@]}"; do
      TRAINED_MODELS+=("${CONTAINER}.${CLASSIFIER}.${ENCODER}")
    done
  done
done
for CLASSIFIER in "${CLASSIFIERS[@]}"; do
  for ENCODER in "${ENCODERS[@]}"; do
    TRAINED_MODELS+=("tabelle1.${CLASSIFIER}.${ENCODER}.ndd")
  done
done

for MODEL in "${TRAINED_MODELS[@]}"; do
  echo "=========================================="
  echo "Evaluating: $MODEL"
  echo "=========================================="
  node src/index.js evaluate --model "$MODEL"
done

echo "=========================================="
echo "Evaluating: rule-based (container tabelle1)"
echo "=========================================="
node src/index.js evaluate --container tabelle1 --rule-based

# ── 4. Externer Test auf tabelle2: Modelle ohne Kontext + Rule-Based ──
echo "=========================================="
echo "Test: extern auf tabelle2 (Modelle ohne Kontext, mit/ohne ndd + Rule-Based)"
echo "=========================================="
TEST_MODELS=()
for CLASSIFIER in "${CLASSIFIERS[@]}"; do
  for ENCODER in "${ENCODERS[@]}"; do
    TEST_MODELS+=("tabelle1.${CLASSIFIER}.${ENCODER}")
    TEST_MODELS+=("tabelle1.${CLASSIFIER}.${ENCODER}.ndd")
  done
done

for MODEL in "${TEST_MODELS[@]}"; do
  echo "=========================================="
  echo "Testing: $MODEL"
  echo "=========================================="
  node src/index.js test --container tabelle2 --model "$MODEL"
done

echo "=========================================="
echo "Testing: rule-based"
echo "=========================================="
node src/index.js test --container tabelle2 --rule-based
