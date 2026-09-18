import React, { useState } from 'react';
import { DiscrepancyReport, ProcessingStats } from '../types';
import { exportReportToExcel } from '../utils/excel';

interface ReportProps {
  discrepancies: DiscrepancyReport[];
  stats: ProcessingStats;
}

const Report: React.FC<ReportProps> = ({ discrepancies, stats }) => {
  const [activeTab, setActiveTab] = useState<'stats' | 'discrepancies'>('stats');
  const [discFilter, setDiscFilter] = useState<string>('all');

  const filteredDiscrepancies = discrepancies.filter(d => 
    discFilter === 'all' || d.type === discFilter
  );

  const tcNotInRef = discrepancies.filter(d => d.type === 'in_tc_not_in_ref');
  const refNotInTc = discrepancies.filter(d => d.type === 'in_ref_not_in_tc');
  const multiple = discrepancies.filter(d => d.type === 'multiple_matches');

  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'in_tc_not_in_ref': return '🔴 В TrueConf, нет в справочнике';
      case 'in_ref_not_in_tc': return '🟡 В справочнике, нет в TrueConf';
      case 'multiple_matches': return '🔵 Множественные совпадения';
      default: return type;
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'in_tc_not_in_ref': return 'border-l-red-500 bg-red-50';
      case 'in_ref_not_in_tc': return 'border-l-yellow-500 bg-yellow-50';
      case 'multiple_matches': return 'border-l-blue-500 bg-blue-50';
      default: return 'border-l-gray-500 bg-gray-50';
    }
  };

  return (
    <div className="space-y-6">
      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-xl">
        <button
          onClick={() => setActiveTab('stats')}
          className={`flex-1 px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${
            activeTab === 'stats' 
              ? 'bg-white shadow text-blue-700' 
              : 'text-gray-600 hover:text-gray-800'
          }`}
        >
          📊 Статистика
        </button>
        <button
          onClick={() => setActiveTab('discrepancies')}
          className={`flex-1 px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${
            activeTab === 'discrepancies' 
              ? 'bg-white shadow text-blue-700' 
              : 'text-gray-600 hover:text-gray-800'
          }`}
        >
          ⚠️ Расхождения ({discrepancies.length})
        </button>
      </div>

      {activeTab === 'stats' && (
        <div className="space-y-6">
          {/* Stats Cards */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl p-5 text-white">
              <div className="text-3xl font-bold">{stats.totalEmployees}</div>
              <div className="text-sm opacity-90 mt-1">Всего сотрудников</div>
            </div>
            <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-xl p-5 text-white">
              <div className="text-3xl font-bold">{stats.matched}</div>
              <div className="text-sm opacity-90 mt-1">Найдено в TC</div>
            </div>
            <div className="bg-gradient-to-br from-yellow-500 to-yellow-600 rounded-xl p-5 text-white">
              <div className="text-3xl font-bold">{stats.unmatched}</div>
              <div className="text-sm opacity-90 mt-1">Не найдено в TC</div>
            </div>
            <div className="bg-gradient-to-br from-red-500 to-red-600 rounded-xl p-5 text-white">
              <div className="text-3xl font-bold">{stats.conflicts}</div>
              <div className="text-sm opacity-90 mt-1">Конфликты</div>
            </div>
            <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl p-5 text-white">
              <div className="text-3xl font-bold">
                {stats.totalEmployees > 0 ? Math.round((stats.matched / stats.totalEmployees) * 100) : 0}%
              </div>
              <div className="text-sm opacity-90 mt-1">Покрытие</div>
            </div>
          </div>

          {/* Progress bar */}
          <div className="bg-white rounded-xl p-6 border border-gray-200">
            <h3 className="font-semibold text-gray-700 mb-3">Прогресс сопоставления</h3>
            <div className="w-full bg-gray-200 rounded-full h-4 overflow-hidden">
              <div className="flex h-full">
                <div 
                  className="bg-green-500 transition-all duration-500"
                  style={{ width: `${stats.totalEmployees > 0 ? (stats.matched / stats.totalEmployees) * 100 : 0}%` }}
                  title={`Найдено: ${stats.matched}`}
                />
                <div 
                  className="bg-yellow-500 transition-all duration-500"
                  style={{ width: `${stats.totalEmployees > 0 ? (stats.unmatched / stats.totalEmployees) * 100 : 0}%` }}
                  title={`Не найдено: ${stats.unmatched}`}
                />
                <div 
                  className="bg-red-500 transition-all duration-500"
                  style={{ width: `${stats.totalEmployees > 0 ? (stats.conflicts / stats.totalEmployees) * 100 : 0}%` }}
                  title={`Конфликты: ${stats.conflicts}`}
                />
              </div>
            </div>
            <div className="flex gap-4 mt-3 text-xs text-gray-500">
              <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-green-500"></span>Найдено</span>
              <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-yellow-500"></span>Не найдено</span>
              <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-red-500"></span>Конфликты</span>
            </div>
          </div>

          {/* Summary by type */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-red-50 border border-red-200 rounded-xl p-4">
              <div className="text-2xl font-bold text-red-700">{tcNotInRef.length}</div>
              <div className="text-sm text-red-600">В TrueConf, нет в справочнике</div>
            </div>
            <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4">
              <div className="text-2xl font-bold text-yellow-700">{refNotInTc.length}</div>
              <div className="text-sm text-yellow-600">В справочнике, нет в TrueConf</div>
            </div>
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
              <div className="text-2xl font-bold text-blue-700">{multiple.length}</div>
              <div className="text-sm text-blue-600">Множественные совпадения</div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'discrepancies' && (
        <div className="space-y-4">
          {/* Filter */}
          <div className="flex gap-2 flex-wrap">
            <button
              onClick={() => setDiscFilter('all')}
              className={`px-3 py-1.5 rounded-lg text-sm ${discFilter === 'all' ? 'bg-gray-800 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
            >
              Все ({discrepancies.length})
            </button>
            <button
              onClick={() => setDiscFilter('in_tc_not_in_ref')}
              className={`px-3 py-1.5 rounded-lg text-sm ${discFilter === 'in_tc_not_in_ref' ? 'bg-red-600 text-white' : 'bg-red-100 text-red-700 hover:bg-red-200'}`}
            >
              В TC нет в справ. ({tcNotInRef.length})
            </button>
            <button
              onClick={() => setDiscFilter('in_ref_not_in_tc')}
              className={`px-3 py-1.5 rounded-lg text-sm ${discFilter === 'in_ref_not_in_tc' ? 'bg-yellow-600 text-white' : 'bg-yellow-100 text-yellow-700 hover:bg-yellow-200'}`}
            >
              В справ. нет в TC ({refNotInTc.length})
            </button>
            <button
              onClick={() => setDiscFilter('multiple_matches')}
              className={`px-3 py-1.5 rounded-lg text-sm ${discFilter === 'multiple_matches' ? 'bg-blue-600 text-white' : 'bg-blue-100 text-blue-700 hover:bg-blue-200'}`}
            >
              Конфликты ({multiple.length})
            </button>
            <button
              onClick={() => exportReportToExcel(discrepancies)}
              className="ml-auto px-3 py-1.5 rounded-lg text-sm bg-green-100 text-green-700 hover:bg-green-200 flex items-center gap-1"
            >
              📥 Экспорт отчёта
            </button>
          </div>

          {/* List */}
          <div className="space-y-2 max-h-[500px] overflow-y-auto">
            {filteredDiscrepancies.map((d, idx) => (
              <div
                key={idx}
                className={`border-l-4 rounded-r-lg p-3 ${getTypeColor(d.type)}`}
              >
                <div className="flex justify-between items-start">
                  <div>
                    <div className="font-medium text-gray-800">{d.name}</div>
                    <div className="text-sm text-gray-600 mt-0.5">{d.details}</div>
                    {d.company && (
                      <div className="text-xs text-gray-500 mt-0.5">Компания: {d.company}</div>
                    )}
                  </div>
                  <span className="text-xs text-gray-400 whitespace-nowrap ml-2">
                    {getTypeLabel(d.type).split(' ')[0]}
                  </span>
                </div>
              </div>
            ))}
          </div>

          {filteredDiscrepancies.length === 0 && (
            <div className="text-center py-8 text-gray-400">
              <div className="text-3xl mb-2">✅</div>
              <p>Нет расхождений для отображения</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default Report;
