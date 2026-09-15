export type SynthParameters = {
  filter: number;
  mood:number;
  movement: number;
  space: number;
  expression: number;
  attack: number;
  decay: number;
  sustain: number;
  release: number;
}

export type CreatePresetInput = {
  name: string;
  schemaVersion: 1;
  parameters: SynthParameters;
}