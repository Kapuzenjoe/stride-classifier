import path from "node:path";
import { ClassifierName } from "../config/classifiers.config.js";

/**
 * Orchestriert alle Prototyp-Ablaeufe.
 */
export class PrototypeController {
  /**
   * @param {object} deps Services und View des Prototyps.
   * @param deps.datasetImportService
   * @param deps.containerBuildService
   * @param deps.containerLoadService
   * @param deps.resultsWriterService
   * @param deps.centroidTrainerService
   * @param deps.knnTrainerService
   * @param deps.svmTrainerService
   * @param deps.classifierPlugin
   * @param deps.contextEnrichmentService
   * @param deps.evaluationService
   * @param deps.metricsService
   * @param deps.view
   * @param deps.evaluationView
   */
  constructor({
    datasetImportService,
    containerBuildService,
    containerLoadService,
    resultsWriterService,
    centroidTrainerService,
    knnTrainerService,
    svmTrainerService,
    classifierPlugin,
    contextEnrichmentService,
    evaluationService,
    metricsService,
    view,
    evaluationView
  }) {
    this.datasetImportService = datasetImportService;
    this.containerBuildService = containerBuildService;
    this.containerLoadService = containerLoadService;
    this.resultsWriterService = resultsWriterService;
    this.centroidTrainerService = centroidTrainerService;
    this.knnTrainerService = knnTrainerService;
    this.svmTrainerService = svmTrainerService;
    this.classifierPlugin = classifierPlugin;
    this.contextEnrichmentService = contextEnrichmentService;
    this.evaluationService = evaluationService;
    this.metricsService = metricsService;
    this.view = view;
    this.evaluationView = evaluationView;
  }

  /**
   * Liest Trainingsdaten aus CSV und persistiert den RequirementContainer als JSON.
   * Mit --with-context wird der Kontext einmalig in die Anforderungstexte eingebacken;
   * alle nachgelagerten Befehle (train, evaluate, test) verwenden den Container direkt.
   *
   * @param {object}  options
   * @param {string}  options.source       Quell-Schluessel aus datasets.config.js.
   * @param {string}  options.output       Dateiname der JSON-Ausgabe (ohne Pfad).
   * @param {boolean} [options.withContext] Kontext in Requirement-Texte einbacken (default: false).
   * @returns {Promise<void>}
   */
  async build({ source = "tabelle1", output, withContext = false }) {
    const sourceConfig = this.datasetImportService.datasetConfig.sources[source];

    const { requirements, labelMap } = await this.datasetImportService.loadSourceCsv(source);
    const { contextElements, relations } = await this.datasetImportService.loadContextData(source);

    if (withContext && contextElements.length === 0) {
      throw new Error(`Quelle "${source}" hat keine konfigurierte Context-CSV – --with-context nicht möglich.`);
    }

    let finalRequirements = requirements;
    let containerId = `container.${source}`;
    let containerName = sourceConfig.label ?? source;

    if (withContext && contextElements.length > 0) {
      const mockContainer = { contextElements, relations };
      const coverage = this.contextEnrichmentService.coverage(requirements, mockContainer);
      this.view.renderContextCoverage(coverage);

      finalRequirements = this.contextEnrichmentService.enrich(requirements, mockContainer);
      containerId = `container.${source}.ctx`;
      containerName = `${sourceConfig.label ?? source} (mit Kontext)`;
    }

    const { container, outputPath } = await this.containerBuildService.build({
      containerId,
      containerName,
      requirements: finalRequirements,
      labelMap,
      outputFileName: output,
      contextElements,
      relations
    });

    this.view.renderBuildResult({ container, outputPath });

    const { labelCardinality, labelDensity } = this.metricsService.computeLabelStats(labelMap);
    this.view.renderLabelStats({ labelCardinality, labelDensity });
  }

  /**
   * Klassifiziert alle Anforderungen eines Containers und gibt eine Zusammenfassung aus.
   *
   * @param {object} options
   * @param {string}  options.containerPath  Pfad zur Container-JSON-Datei.
   * @param {string}  options.classifierName Name des Klassifikators (rule-based | centroid | knn | svm).
   * @param {string}  [options.encoderName]  Name des Encoders (fuer Dateinamen).
   * @param {string}  options.csvPath  Ausgabepfad der Label-CSV.
   * @returns {Promise<import("../models/ClassificationResult.js").ClassificationResult[]>}
   */
  async classify({ containerPath, classifierName, encoderName, csvPath }) {
    const { container, labelMap } = await this.containerLoadService.load(containerPath);
    const results = await this.classifierPlugin.classify(container.requirements);

    const textMap = this.#buildTextMap(container);
    const resultPath = await this.resultsWriterService.write({ classifierName, encoderName, containerPath, results, labelMap, textMap });
    const labelCsvPath = await this.resultsWriterService.writeLabelCsv({ results, textMap, outputFileName: csvPath });

    const withLabel = results.filter(r => r.labels.length > 0).length;
    this.view.renderClassifySummary({ withLabel, total: results.length, classifierName, container, resultPath, labelCsvPath });

    return results;
  }

  /**
   * Evaluiert einen Klassifikator auf einem Container (Test-Split + Cross-Validation).
   *
   * @param {object} options
   * @param {string}  options.containerPath  Pfad zur Container-JSON-Datei.
   * @param {string}  options.classifierName Name des Klassifikators.
   * @param {string}  [options.encoderName]  Name des Encoders (fuer Dateinamen).
   * @param {boolean} [options.useNdd]        Near-Duplicate-Clustering vor dem Split anwenden (default: false).
   * @returns {Promise<void>}
   */
  async evaluate({ containerPath, classifierName, encoderName, useNdd = false }) {

    const { container, labelMap } = await this.containerLoadService.load(containerPath);
    this.#ensureGroundTruth(labelMap, containerPath);

    const { test } = this.evaluationService.splitTrainValTest(container.requirements, labelMap, { useNdd });

    const testResults = await this.classifierPlugin.classify(test);
    const perClass = this.metricsService.computePerClass(testResults, labelMap);
    const { microF1, macroF1 } = this.metricsService.computeAggregate(perClass);

    const textMap = this.#buildTextMap(container);
    const resultPath = await this.resultsWriterService.write({
      classifierName, encoderName, containerPath,
      results: testResults, labelMap, textMap
    });

    this.evaluationView.renderEvaluationTable({
      classifierName, perClass, microF1, macroF1,
      splitName: "test (intern)", splitSize: test.length,
      resultPath
    });
  }

  /**
   * Evaluiert einen vortrainierten Klassifikator auf einem externen Test-Container.
   *
   * @param {object} options
   * @param {string}  options.containerPath  Pfad zur externen Container-JSON.
   * @param {string}  options.classifierName Name des Klassifikators.
   * @param {string}  [options.encoderName]  Name des Encoders (fuer Dateinamen).
   * @returns {Promise<void>}
   */
  async test({ containerPath, classifierName, encoderName }) {

    const { container, labelMap } = await this.containerLoadService.load(containerPath);
    this.#ensureGroundTruth(labelMap, containerPath);

    const results = await this.classifierPlugin.classify(container.requirements);
    const perClass = this.metricsService.computePerClass(results, labelMap);
    const { microF1, macroF1 } = this.metricsService.computeAggregate(perClass);

    const textMap = this.#buildTextMap(container);
    const resultPath = await this.resultsWriterService.write({
      classifierName, encoderName,
      containerPath, results, labelMap, textMap
    });

    this.evaluationView.renderEvaluationTable({
      classifierName, perClass, microF1, macroF1,
      splitName: "extern (gesamt)", splitSize: container.requirements.length,
      resultPath
    });
  }

  /**
   * Trainiert einen Klassifikator und persistiert das Modell.
   *
   * @param {object} options
   * @param {string} options.containerPath  Pfad zur Container-JSON-Datei.
   * @param {string} options.output         Dateiname der Modell-Ausgabe.
   * @param {string} [options.classifierName] Wählt den Trainer (default: centroid).
   * @param {boolean} [options.useNdd]        Near-Duplicate-Clustering vor dem Split anwenden (default: false).
   * @returns {Promise<void>}
   */
  async train({ containerPath, output, classifierName = ClassifierName.CENTROID, useNdd = false }) {

    const { container, labelMap } = await this.containerLoadService.load(containerPath);
    const containerSource = this.#extractSource(containerPath);

    const { train, validation } = this.evaluationService.splitTrainValTest(container.requirements, labelMap, { useNdd });

    this.view.renderTrainStart({ containerName: container.name, classifierName, total: train.length });

    const trainerOpts = {
      trainRequirements: train,
      valRequirements: validation,
      labelMap,
      outputFileName: output,
      containerSource,
      onProgress: (done, total) => this.view.renderTrainProgress(done, total),
      onWarning: codes => this.view.renderTrainWarning(codes)
    };

    const trainerMap = {
      [ClassifierName.SVM]: this.svmTrainerService,
      [ClassifierName.KNN]: this.knnTrainerService,
      [ClassifierName.CENTROID]: this.centroidTrainerService
    };
    const result = await trainerMap[classifierName].train(trainerOpts);
    this.view.renderTrainResult({ classifierName, ...result });
  }

  // ── Private Hilfsmethoden ────────────────────────────────────────────────────

  /**
   * Baut eine Map von Anforderungs-ID zu Anforderungstext.
   *
   * @param {import("../models/RequirementContainer.js").RequirementContainer} container
   * @returns {Map<string, string>}
   */
  #buildTextMap(container) {
    return new Map(container.requirements.map(r => [r.id, r.text]));
  }

  /**
   * Extrahiert den Quell-Schluessel aus einem Container-Pfad.
   * "…/container.tabelle1.ctx.json" -> "tabelle1.ctx"
   *
   * @param {string} containerPath
   * @returns {string}
   */
  #extractSource(containerPath) {
    return path.basename(containerPath, ".json").replace(/^container\./, "");
  }

  /**
   * Wirft einen Fehler wenn der Container keine Ground-Truth-Labels enthält.
   *
   * @param {Map<string, object>} labelMap
   * @param {string} containerPath
   */
  #ensureGroundTruth(labelMap, containerPath) {
    if (Array.from(labelMap.values()).some(l => Object.values(l).some(Boolean))) return;
    throw new Error(`Container "${path.basename(containerPath)}" enthaelt keine Ground-Truth-Labels.`);
  }

}
