import React, { useState, useEffect } from 'react';
import { StoredFile, getStorageInfo, getHistory, HistoryEntry, clearAll } from '../utils/storage';
import { formatFileSize } from '../utils/projectFile';

interface ContainerPanelProps {
  isOpen: boolean;
  onClose: () => void;
  files: StoredFile[];
  onDeleteFile: (id: string) => void;
  onClearAll: () => void;
  employeeCount: number;
  matchedCount: number;
}

const ContainerPanel: React.FC<ContainerPanelProps> = ({
  isOpen,
  onClose,
  files,
  onDeleteFile,
  onClearAll,
  employeeCount,
  matchedCount,
}) => {
  const [storageInfo, setStorageInfo] = useState({ files: 0, totalSize: 0, historyCount: 0 });
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [activeSection, setActiveSection] = useState<'overview' | 'files' | 'history'>('overview');
  const [showConfirmClear, setShowConfirmClear] = useState(false);

  useEffect(() => {
    if (isOpen) {
      loadInfo();
    }
  }, [isOpen, files.length]);

  const loadInfo = async () => {
    const info = await getStorageInfo();
    setStorageInfo(info);
    const hist = await getHistory(20);
    setHistory(hist);
  };

  const handleClearAll = async () => {
    await clearAll();
    onClearAll();
    setShowConfirmClear(false);
    loadInfo();
  };

  const getActionIcon = (action: string) => {
    if (action.includes('загрузк') || action.includes('Загрузк')) return '📥';
    if (action.includes('сопостав')) return '🔄';
    if (action.includes('экспорт') || action.includes('Экспорт')) return '📤';
    if (action.includes('удален') || action.includes('Удален')) return '🗑️';
    if (action.includes('изменен') || action.includes('редакт')) return '✏️';
    return '📌';
  };

  const formatTime = (ts: string) => {
    const d = new Date(ts);
    return d.toLocaleString('ru-RU', { 
      day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' 
    });
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Overlay */}
      <div 
        className="fixed inset-0 bg-black/30 backdrop-blur-sm z-40"
        onClick={onClose}
      />
      
      {/* Panel */}
      <div className="fixed right-0 top-0 bottom-0 w-full max-w-md bg-white shadow-2xl z-50 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-slate-800 to-slate-900 text-white p-5">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-emerald-500 rounded-lg flex items-center justify-center text-sm">
                📦
              </div>
              <div>
                <h2 className="font-bold text-base">Контейнер данных</h2>
                <p className="text-xs text-slate-400">Изолированное хранилище</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors"
            >
              ✕
            </button>
          </div>
          
          {/* Status indicator */}
          <div className="flex items-center gap-2 bg-emerald-500/20 border border-emerald-500/30 rounded-lg px-3 py-2">
            <div className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse"></div>
            <span className="text-xs text-emerald-300">Контейнер активен • Данные сохранены в браузере</span>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-200 bg-gray-50">
          <button
            onClick={() => setActiveSection('overview')}
            className={`flex-1 px-4 py-2.5 text-xs font-medium transition-colors ${
              activeSection === 'overview' ? 'bg-white text-blue-700 border-b-2 border-blue-600' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            📊 Обзор
          </button>
          <button
            onClick={() => setActiveSection('files')}
            className={`flex-1 px-4 py-2.5 text-xs font-medium transition-colors ${
              activeSection === 'files' ? 'bg-white text-blue-700 border-b-2 border-blue-600' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            📁 Файлы ({files.length})
          </button>
          <button
            onClick={() => setActiveSection('history')}
            className={`flex-1 px-4 py-2.5 text-xs font-medium transition-colors ${
              activeSection === 'history' ? 'bg-white text-blue-700 border-b-2 border-blue-600' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            📜 История
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {activeSection === 'overview' && (
            <div className="space-y-4">
              {/* Stats grid */}
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-blue-50 border border-blue-100 rounded-xl p-3">
                  <div className="text-2xl font-bold text-blue-700">{employeeCount}</div>
                  <div className="text-xs text-blue-600">Сотрудников</div>
                </div>
                <div className="bg-green-50 border border-green-100 rounded-xl p-3">
                  <div className="text-2xl font-bold text-green-700">{matchedCount}</div>
                  <div className="text-xs text-green-600">Сопоставлено</div>
                </div>
                <div className="bg-purple-50 border border-purple-100 rounded-xl p-3">
                  <div className="text-2xl font-bold text-purple-700">{files.length}</div>
                  <div className="text-xs text-purple-600">Файлов</div>
                </div>
                <div className="bg-amber-50 border border-amber-100 rounded-xl p-3">
                  <div className="text-2xl font-bold text-amber-700">{formatFileSize(storageInfo.totalSize)}</div>
                  <div className="text-xs text-amber-600">Объём данных</div>
                </div>
              </div>

              {/* Container info */}
              <div className="bg-gray-50 rounded-xl p-4 border border-gray-200">
                <h3 className="font-semibold text-gray-700 text-sm mb-3">🔒 Информация о контейнере</h3>
                <div className="space-y-2 text-xs text-gray-600">
                  <div className="flex justify-between">
                    <span>Хранилище:</span>
                    <span className="font-medium">IndexedDB (локальное)</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Изоляция:</span>
                    <span className="font-medium text-green-600">✓ Полная</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Автосохранение:</span>
                    <span className="font-medium text-green-600">✓ Включено</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Записей в истории:</span>
                    <span className="font-medium">{storageInfo.historyCount}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Версия контейнера:</span>
                    <span className="font-medium">1.0.0</span>
                  </div>
                </div>
              </div>

              {/* Danger zone */}
              <div className="bg-red-50 border border-red-200 rounded-xl p-4">
                <h3 className="font-semibold text-red-700 text-sm mb-2">⚠️ Опасная зона</h3>
                <p className="text-xs text-red-600 mb-3">
                  Полная очистка удалит все данные из контейнера без возможности восстановления.
                </p>
                {showConfirmClear ? (
                  <div className="flex gap-2">
                    <button
                      onClick={handleClearAll}
                      className="px-3 py-1.5 bg-red-600 text-white rounded-lg text-xs font-medium hover:bg-red-700"
                    >
                      Да, удалить всё
                    </button>
                    <button
                      onClick={() => setShowConfirmClear(false)}
                      className="px-3 py-1.5 bg-gray-200 text-gray-700 rounded-lg text-xs font-medium hover:bg-gray-300"
                    >
                      Отмена
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setShowConfirmClear(true)}
                    className="px-3 py-1.5 bg-red-100 text-red-700 rounded-lg text-xs font-medium hover:bg-red-200"
                  >
                    🗑️ Очистить контейнер
                  </button>
                )}
              </div>
            </div>
          )}

          {activeSection === 'files' && (
            <div className="space-y-3">
              {files.length === 0 ? (
                <div className="text-center py-8 text-gray-400">
                  <div className="text-3xl mb-2">📂</div>
                  <p className="text-sm">Контейнер пуст</p>
                  <p className="text-xs mt-1">Загрузите файлы на вкладке «Файлы»</p>
                </div>
              ) : (
                files.map(file => (
                  <div key={file.id} className="bg-white border border-gray-200 rounded-xl p-3 hover:shadow-sm transition-shadow">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-lg">
                          {file.type === 'reference' ? '📋' : '📡'}
                        </span>
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-gray-800 truncate">{file.name}</p>
                          <p className="text-xs text-gray-500">
                            {file.type === 'reference' ? 'Справочник' : 'TrueConf'} • {file.recordCount} записей • {formatFileSize(file.size)}
                          </p>
                        </div>
                      </div>
                      <button
                        onClick={() => onDeleteFile(file.id)}
                        className="text-red-400 hover:text-red-600 text-sm p-1"
                        title="Удалить файл"
                      >
                        🗑️
                      </button>
                    </div>
                    <div className="mt-2 text-xs text-gray-400">
                      Загружен: {formatTime(file.uploadedAt)}
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {activeSection === 'history' && (
            <div className="space-y-2">
              {history.length === 0 ? (
                <div className="text-center py-8 text-gray-400">
                  <div className="text-3xl mb-2">📜</div>
                  <p className="text-sm">История пуста</p>
                </div>
              ) : (
                history.map(entry => (
                  <div key={entry.id} className="flex items-start gap-2 py-2 border-b border-gray-100 last:border-0">
                    <span className="text-sm mt-0.5">{getActionIcon(entry.action)}</span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm text-gray-700">{entry.action}</p>
                      <p className="text-xs text-gray-400">{entry.details}</p>
                      {entry.snapshot && (
                        <p className="text-xs text-gray-400 mt-0.5">
                          {entry.snapshot.employeeCount} сотрудников • {entry.snapshot.matchedCount} сопоставлено
                        </p>
                      )}
                    </div>
                    <span className="text-xs text-gray-400 whitespace-nowrap">{formatTime(entry.timestamp)}</span>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </div>
    </>
  );
};

export default ContainerPanel;
