import path from "node:path";
import { readFile } from "node:fs/promises";
import { parseArgs } from "node:util";
import { datasets } from "./config/datasets.config.js";
import { encoderConfigs, EncoderName } from "./config/encoders.config.js";
import { PrototypeController } from "./controllers/PrototypeController.js";
import { DatasetImportService } from "./services/DatasetImportService.js";
import { ContainerBuildService } from "./services/ContainerBuildService.js";
import { ContainerLoadService } from "./services/ContainerLoadService.js";
import { ResultsWriterService } from "./services/ResultsWriterService.js";
import { CentroidTrainerService } from "./services/trainer/CentroidTrainerService.js";
import { KnnTrainerService } from "./services/trainer/KnnTrainerService.js";
import { SvmTrainerService } from "./services/trainer/SvmTrainerService.js";
import { ConsoleView } from "./views/ConsoleView.js";
import { EvaluationView } from "./views/EvaluationView.js";
import { TransformerCentroidClassifierPlugin } from "./plugins/centroid/TransformerCentroidClassifierPlugin.js";
import { TransformerKnnClassifierPlugin } from "./plugins/knn/TransformerKnnClassifierPlugin.js";
import { TransformerSvmClassifierPlugin } from "./plugins/svm/TransformerSvmClassifierPlugin.js";
import { RuleBasedClassifierPlugin } from "./plugins/ruleBased/RuleBasedClassifierPlugin.js";
import { ContextEnrichmentService } from "./services/ContextEnrichmentService.js";
import { EvaluationService } from "./services/EvaluationService.js";
import { MetricsService } from "./services/MetricsService.js";
import { ClassifierName } from "./config/classifiers.config.js";

const { positionals, values: args } = parseArgs({
  args: process.argv.slice(2),
  options: {
    container: { type: "string" },
    classifier: { type: "string" },
    model: { type: "string" },
    encoder: { type: "string" },
    source: { type: "string" },
    csv: { type: "string" },
    k: { type: "string" },          // KNN: fixes k erzwingen (sonst Grid-Suche)
    "rule-based": { type: "boolean", default: false },
    "with-context": { type: "boolean", default: false }
  },
  allowPositionals: true,
  strict: true
});

const [command] = positionals;

// ─── Pfad-Auflösung ───────────────────────────────────────────────────────────

/**
 * Loest arg zu einem absoluten Pfad auf.
 *
 * @param {string} arg
 * @param {string} dir     Default-Verzeichnis.
 * @param {string} prefix  Default-Praefix.
 * @returns {string}
 */
function resolvePath(arg, dir, prefix) {
  if (!arg) return arg;
  if (path.isAbsolute(arg) || arg.includes(path.sep)) return arg;
  return path.join(dir, arg.endsWith(".json") ? arg : `${prefix}${arg}.json`);
}
const resolveContainerPath = arg => resolvePath(arg, datasets.containerOutputDir, "container.");
const resolveModelPath = arg => resolvePath(arg, datasets.modelsDir, "model.");

/**
 * Baut den Default-Dateinamen fuer ein trainiertes Modell.
 *
 * @param {string} containerArg
 * @param {string} classifier
 * @param {string} encoder
 * @returns {string}
 */
function defaultModelFileName(containerArg, classifier, encoder) {
  const source = path.basename(containerArg ?? "unknown", ".json").replace(/^container\./, "");
  return `model.${[source, classifier, encoder].join(".")}.json`;
}

// ─── Classifier/Encoder aus Modell ableiten (evaluate / test / classify) ──────

if (["evaluate", "test", "classify"].includes(command)) {
  if (args["rule-based"]) {
    args.classifier = ClassifierName.RULE_BASED;
  } else if (!args.model) {
    if (command === "evaluate") {
      console.error("Fehler: \"evaluate\" benötigt --model <pfad|kuerzel>.");
      process.exit(1);
    }
    // Kein --model angegeben bei test/classify → rule-based als Fallback
    args.classifier = ClassifierName.RULE_BASED;
  } else {
    const modelFilePath = resolveModelPath(args.model);
    let modelJson;
    try {
      modelJson = JSON.parse(await readFile(modelFilePath, "utf-8"));
    } catch{
      console.error(`Fehler: Modell "${args.model}" nicht gefunden: "${modelFilePath}"`);
      process.exit(1);
    }
    if (!modelJson.classifierName || !modelJson.encoderName) {
      console.error(`Fehler: Modell "${args.model}" hat ungültige Struktur – classifierName oder encoderName fehlen.`);
      process.exit(1);
    }
    args.classifier = modelJson.classifierName;
    args.encoder = modelJson.encoderName;
    if (command === "evaluate") args.container ??= modelJson.containerSource;
  }
}

args.classifier ??= ClassifierName.RULE_BASED;
args.encoder ??= EncoderName.JINA_DE;

// ─── Encoder-Config auflösen ──────────────────────────────────────────────────
const encoderConfig = encoderConfigs[args.encoder];
if (!encoderConfig) {
  console.error(`Unbekannter Encoder: "${args.encoder}". Verfuegbar: ${Object.values(EncoderName).join(" | ")}`);
  process.exit(1);
}

const containerPath = resolveContainerPath(args.container);
const encoderNameForFile = args.classifier === ClassifierName.RULE_BASED ? null : encoderConfig.name;

// ─── Trainer-Plugins: nur bei train erstellen ─────────────────────────────────
let trainerServices = { centroidTrainerService: null, knnTrainerService: null, svmTrainerService: null };
if (command === "train") {
  const centroidPlugin = new TransformerCentroidClassifierPlugin({ encoderConfig, modelPath: null });
  const knnPlugin = new TransformerKnnClassifierPlugin({ encoderConfig, modelPath: null });
  const svmPlugin = new TransformerSvmClassifierPlugin({ encoderConfig, modelPath: null });
  trainerServices = {
    centroidTrainerService: new CentroidTrainerService({ classifier: centroidPlugin, datasets }),
    knnTrainerService: new KnnTrainerService({ classifier: knnPlugin, datasets, k: args.k ? Number(args.k) : null }),
    svmTrainerService: new SvmTrainerService({ classifier: svmPlugin, datasets })
  };
}

// ─── Inference-Plugin erstellen ───────────────────────────────────────────────
/**
 * Erstellt das passende Classifier-Plugin fuer den gegebenen Klassifikator-Namen.
 *
 * @param {string} name
 * @returns {import("./plugins/ClassifierPlugin.js").ClassifierPlugin}
 */
function createClassifierPlugin(name) {
  const modelPath = resolveModelPath(args.model);
  switch (name) {
    case ClassifierName.RULE_BASED:
      return new RuleBasedClassifierPlugin();
    case ClassifierName.CENTROID:
      return new TransformerCentroidClassifierPlugin({ encoderConfig, modelPath });
    case ClassifierName.KNN:
      return new TransformerKnnClassifierPlugin({ encoderConfig, modelPath });
    case ClassifierName.SVM:
      return new TransformerSvmClassifierPlugin({ encoderConfig, modelPath });
    default:
      throw new Error(`Unbekannter Klassifikator: "${name}". Verfuegbar: ${Object.values(ClassifierName).join(" | ")}`);
  }
}

const classifierPlugin = command === "train"
  ? new RuleBasedClassifierPlugin() // Dummy – bei train nicht verwendet
  : createClassifierPlugin(args.classifier);

// ─── Controller ──────────────────────────────────────────────────────────────
const controller = new PrototypeController({
  datasetImportService: new DatasetImportService(datasets),
  containerBuildService: new ContainerBuildService(datasets),
  containerLoadService: new ContainerLoadService(),
  resultsWriterService: new ResultsWriterService(datasets),
  ...trainerServices,
  classifierPlugin,
  contextEnrichmentService: new ContextEnrichmentService(),
  evaluationService: new EvaluationService(),
  metricsService: new MetricsService(),
  view: new ConsoleView(),
  evaluationView: new EvaluationView()
});

// ─── Befehls-Dispatch ────────────────────────────────────────────────────────
switch (command) {

  case "build": {
    const source = args.source ?? "tabelle1";
    await controller.build({ source, withContext: args["with-context"] });
    break;
  }

  case "train":
    if (!containerPath) { console.error("Fehler: \"train\" benötigt --container."); process.exit(1); }
    if (!args.classifier || args.classifier === ClassifierName.RULE_BASED) {
      console.error("Fehler: \"train\" benötigt --classifier (centroid | knn | svm)."); process.exit(1);
    }
    await controller.train({
      containerPath,
      classifierName: args.classifier,
      output: defaultModelFileName(args.container, args.classifier, args.encoder)
    });
    break;

  case "evaluate":
    if (!containerPath) { console.error("Fehler: \"evaluate\" benötigt --container (oder ein Modell mit containerSource)."); process.exit(1); }
    await controller.evaluate({
      containerPath,
      classifierName: args.classifier,
      encoderName: encoderNameForFile
    });
    break;

  case "test":
    if (!containerPath) { console.error("Fehler: \"test\" benötigt --container."); process.exit(1); }
    await controller.test({
      containerPath,
      classifierName: args.classifier,
      encoderName: encoderNameForFile
    });
    break;

  case "classify": {
    if (!containerPath) { console.error("Fehler: \"classify\" benötigt --container."); process.exit(1); }
    const source = path.basename(args.container ?? "unknown", ".json").replace(/^container\./, "");
    const csvSuffix = encoderNameForFile ? `.${encoderNameForFile}` : "";
    const csvPath = args.csv
      ?? path.join(datasets.resultsDir, `labels.${source}.${args.classifier}${csvSuffix}.csv`);
    await controller.classify({
      containerPath,
      classifierName: args.classifier,
      encoderName: encoderNameForFile,
      csvPath
    });
    break;
  }

  default:
    console.error(`Unbekannter Befehl: "${command}"`);
    console.error("Verfuegbare Befehle: build | train | evaluate | test | classify");
    process.exit(1);
}
