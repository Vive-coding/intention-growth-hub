declare module 'node-nlp' {
  export interface NlpManagerOptions {
    languages: string[];
    [key: string]: any;
  }

  export interface Entity {
    entity: string;
    sourceText: string;
    accuracy?: number;
    start?: number;
    end?: number;
    len?: number;
    [key: string]: any;
  }

  export interface ProcessResult {
    locale: string;
    utterance: string;
    settings: any;
    languageGuessed: boolean;
    localeIso2: string;
    language: string;
    explanation: any[];
    classifications: any[];
    intent: string;
    score: number;
    domain: string;
    sourceEntities: any[];
    entities: Entity[];
    answers: any[];
    actions: any[];
    sentiment: {
      score: number;
      comparative: number;
      vote: string;
      numWords: number;
      numHits: number;
      type: string;
      language: string;
    };
  }

  export class NlpManager {
    constructor(settings?: NlpManagerOptions);
    addNamedEntityText(
      entityName: string,
      optionName: string,
      languages: string[],
      examples: string[]
    ): void;
    train(): Promise<void>;
    process(text: string): Promise<ProcessResult>;
  }
} 