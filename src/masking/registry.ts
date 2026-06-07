import type { MaskingConfig } from '../config/types';
import type { IDetector } from './types';
import {
  TcIdDetector,
  PhoneDetector,
  EmailDetector,
  PersonDetector,
} from './detectors/turkish-pii';
import { IbanDetector, CreditCardDetector } from './detectors/financial';
import {
  DiagnosisCodeDetector,
  PatientIdDetector,
  MedicationDetector,
} from './detectors/medical';
import { KeywordDetector } from './detectors/keyword';

export function buildDetectors(config: MaskingConfig): IDetector[] {
  const { detectors } = config;
  const list: IDetector[] = [];

  if (detectors.turkishPii?.enabled) {
    const e = detectors.turkishPii.entities;
    if (e?.tcId) list.push(new TcIdDetector(true));
    if (e?.phone) list.push(new PhoneDetector(true));
    if (e?.email) list.push(new EmailDetector(true));
    if (e?.name) list.push(new PersonDetector(true));
  }

  if (detectors.financial?.enabled) {
    const e = detectors.financial.entities;
    if (e?.iban) list.push(new IbanDetector(true));
    if (e?.creditCard) list.push(new CreditCardDetector(true));
  }

  if (detectors.medical?.enabled) {
    const e = detectors.medical.entities;
    const medList = detectors.medical.medicationList ?? [];
    if (e?.diagnosisCodes) list.push(new DiagnosisCodeDetector(true));
    if (e?.patientId) list.push(new PatientIdDetector(true));
    if (e?.medications) list.push(new MedicationDetector(true, medList));
  }

  if (detectors.keywords?.enabled) {
    list.push(
      new KeywordDetector(
        true,
        detectors.keywords.blocklist ?? [],
        detectors.keywords.caseSensitive ?? false
      )
    );
  }

  return list;
}
