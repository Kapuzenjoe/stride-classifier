#!/bin/bash
set -e

mkdir -p data/results
exec > >(tee "data/results/run_$(date +%Y%m%d_%H%M%S).log") 2>&1

ENCODERS=(jina-de e5-large bge-m3)
CLASSIFIERS=(svm knn centroid)

# ── 1. Container bauen (train/train.ctx fuer Training, ext1-ctx/ext2-plain fuer externen Test) ──
echo "=========================================="
echo "Build: Container"
echo "=========================================="
node src/index.js build --source train
node src/index.js build --source train --with-context
node src/index.js build --source ext1-ctx --with-context
node src/index.js build --source ext2-plain

# ── 2. Training: train, train.ctx, je 9 Encoder/Classifier-Kombos ──
echo "=========================================="
echo "Train: train & train.ctx (9 Kombos je Variante = 18 Modelle)"
echo "=========================================="
for CONTAINER in train train.ctx; do
  for CLASSIFIER in "${CLASSIFIERS[@]}"; do
    for ENCODER in "${ENCODERS[@]}"; do
      echo "------------------------------------------"
      echo "Training: $CONTAINER / $CLASSIFIER / $ENCODER"
      echo "------------------------------------------"
      node src/index.js train --container "$CONTAINER" --classifier "$CLASSIFIER" --encoder "$ENCODER"
    done
  done
done

# ── 3. Interne Evaluation: alle 18 trainierten Modelle + Rule-Based auf train ──
echo "=========================================="
echo "Evaluate: interner Test-Split (18 Modelle + Rule-Based)"
echo "=========================================="
TRAINED_MODELS=()
for CONTAINER in train train.ctx; do
  for CLASSIFIER in "${CLASSIFIERS[@]}"; do
    for ENCODER in "${ENCODERS[@]}"; do
      TRAINED_MODELS+=("${CONTAINER}.${CLASSIFIER}.${ENCODER}")
    done
  done
done

for MODEL in "${TRAINED_MODELS[@]}"; do
  echo "=========================================="
  echo "Evaluating: $MODEL"
  echo "=========================================="
  node src/index.js evaluate --model "$MODEL"
done

echo "=========================================="
echo "Evaluating: rule-based (container train)"
echo "=========================================="
node src/index.js evaluate --container train --rule-based

# ── 4. Externer Test ohne Kontext auf ext2-plain: Modelle ohne Kontext + Rule-Based ──
echo "=========================================="
echo "Test: extern ohne Kontext auf ext2-plain (Modelle ohne Kontext + Rule-Based)"
echo "=========================================="
TEST_MODELS_PLAIN=()
for CLASSIFIER in "${CLASSIFIERS[@]}"; do
  for ENCODER in "${ENCODERS[@]}"; do
    TEST_MODELS_PLAIN+=("train.${CLASSIFIER}.${ENCODER}")
  done
done

for MODEL in "${TEST_MODELS_PLAIN[@]}"; do
  echo "=========================================="
  echo "Testing: $MODEL auf ext2-plain"
  echo "=========================================="
  node src/index.js test --container ext2-plain --model "$MODEL"
done

echo "=========================================="
echo "Testing: rule-based auf ext2-plain"
echo "=========================================="
node src/index.js test --container ext2-plain --rule-based

# ── 5. Externer Test mit Kontext auf ext1-ctx: Modelle mit Kontext + Rule-Based ──
echo "=========================================="
echo "Test: extern mit Kontext auf ext1-ctx (Modelle mit Kontext + Rule-Based)"
echo "=========================================="
TEST_MODELS_CTX=()
for CLASSIFIER in "${CLASSIFIERS[@]}"; do
  for ENCODER in "${ENCODERS[@]}"; do
    TEST_MODELS_CTX+=("train.ctx.${CLASSIFIER}.${ENCODER}")
  done
done

for MODEL in "${TEST_MODELS_CTX[@]}"; do
  echo "=========================================="
  echo "Testing: $MODEL auf ext1-ctx"
  echo "=========================================="
  node src/index.js test --container ext1-ctx.ctx --model "$MODEL"
done

echo "=========================================="
echo "Testing: rule-based auf ext1-ctx"
echo "=========================================="
node src/index.js test --container ext1-ctx.ctx --rule-based
