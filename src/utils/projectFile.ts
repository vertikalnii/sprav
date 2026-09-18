/**
 * Project File — экспорт/импорт всего проекта как единого файла.
 * Формат: .spravochnik (JSON с бинарными данными в base64)
 */

import { Employee, TrueConfUser, DiscrepancyReport, ProcessingStats } from '../types';
import { StoredFile } from './storage';

export interface ProjectData {
  version: string;
  createdAt: string;
  appName: string;
  state: {
    employees: Employee[];
    trueConfUsers: TrueConfUser[];
    discrepancies: DiscrepancyReport[];
    stats: ProcessingStats;
    refFileName: string;
    tcFiles: string[];
  };
  files: Array<{
    id: string;
    name: string;
    type: 'reference' | 'trueconf';
    dataBase64: string;
    size: number;
    uploadedAt: string;
    recordCount: number;
  }>;
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

export function serializeProject(
  state: {
    employees: Employee[];
    trueConfUsers: TrueConfUser[];
    discrepancies: DiscrepancyReport[];
    stats: ProcessingStats;
    refFileName: string;
    tcFiles: string[];
  },
  files: StoredFile[]
): string {
  const project: ProjectData = {
    version: '1.0.0',
    createdAt: new Date().toISOString(),
    appName: 'Справочник сотрудников ПАО СН-МНГ',
    state,
    files: files.map(f => ({
      id: f.id,
      name: f.name,
      type: f.type,
      dataBase64: arrayBufferToBase64(f.data),
      size: f.size,
      uploadedAt: f.uploadedAt,
      recordCount: f.recordCount,
    })),
  };
  return JSON.stringify(project, null, 2);
}

export function deserializeProject(json: string): {
  state: ProjectData['state'];
  files: StoredFile[];
} {
  const project: ProjectData = JSON.parse(json);
  
  if (!project.version || !project.state) {
    throw new Error('Неверный формат файла проекта');
  }

  const files: StoredFile[] = project.files.map(f => ({
    id: f.id,
    name: f.name,
    type: f.type,
    data: base64ToArrayBuffer(f.dataBase64),
    size: f.size,
    uploadedAt: f.uploadedAt,
    recordCount: f.recordCount,
  }));

  return {
    state: project.state,
    files,
  };
}

export function downloadProjectFile(content: string, filename: string) {
  const blob = new Blob([content], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Б';
  const k = 1024;
  const sizes = ['Б', 'КБ', 'МБ', 'ГБ'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}
