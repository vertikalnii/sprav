import React, { useState } from 'react';
import { TrueConfUser } from '../types';

interface TrueConfViewProps {
  users: TrueConfUser[];
  files: string[];
}

const TrueConfView: React.FC<TrueConfViewProps> = ({ users, files }) => {
  const [filter, setFilter] = useState('');
  const [companyFilter, setCompanyFilter] = useState('all');

  const companies = [...new Set(users.map(u => u.company))].filter(Boolean).sort();

  const filtered = users.filter(u => {
    const matchesText = !filter || 
      u.fullName.toLowerCase().includes(filter.toLowerCase()) ||
      u.login.toLowerCase().includes(filter.toLowerCase()) ||
      u.attribute.toLowerCase().includes(filter.toLowerCase());
    const matchesCompany = companyFilter === 'all' || u.company === companyFilter;
    return matchesText && matchesCompany;
  });

  const targetCompanies = ['МЭН', 'МЕН', 'ПАО', 'PAO', 'СН-МНГ', 'МУБР', 'MUBR'];
  const isTarget = (company: string) => {
    const upper = company.toUpperCase();
    return targetCompanies.some(t => upper.includes(t));
  };

  return (
    <div className="space-y-4">
      {/* Files info */}
      <div className="flex flex-wrap gap-2">
        {files.map((f, i) => (
          <span key={i} className="px-3 py-1 bg-indigo-100 text-indigo-700 rounded-full text-xs font-medium">
            📄 {f}
          </span>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <input
          type="text"
          placeholder="🔍 Поиск по ФИО, логину, ID..."
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="flex-1 min-w-[200px] px-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
        <select
          value={companyFilter}
          onChange={(e) => setCompanyFilter(e.target.value)}
          className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          <option value="all">Все компании</option>
          {companies.map(c => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
        <span className="self-center text-sm text-gray-500">
          {filtered.length} из {users.length}
        </span>
      </div>

      {/* Table */}
      <div className="overflow-x-auto border border-gray-200 rounded-xl shadow-sm">
        <table className="w-full text-sm">
          <thead className="bg-gray-100">
            <tr>
              <th className="px-3 py-2.5 text-left font-semibold text-gray-600">Логин</th>
              <th className="px-3 py-2.5 text-left font-semibold text-gray-600">ФИО</th>
              <th className="px-3 py-2.5 text-left font-semibold text-gray-600">ID (Атрибут)</th>
              <th className="px-3 py-2.5 text-left font-semibold text-gray-600">Компания</th>
              <th className="px-3 py-2.5 text-left font-semibold text-gray-600">Email</th>
              <th className="px-3 py-2.5 text-left font-semibold text-gray-600">Файл</th>
              <th className="px-3 py-2.5 text-left font-semibold text-gray-600">Целевая</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {filtered.slice(0, 100).map((user, idx) => (
              <tr key={idx} className={`hover:bg-gray-50 ${isTarget(user.company) ? '' : 'opacity-60'}`}>
                <td className="px-3 py-2 font-mono text-xs text-gray-600">{user.login}</td>
                <td className="px-3 py-2 font-medium">{user.fullName}</td>
                <td className="px-3 py-2 font-mono text-xs text-indigo-600">{user.attribute}</td>
                <td className="px-3 py-2 text-xs">{user.company}</td>
                <td className="px-3 py-2 text-xs text-gray-500">{user.email}</td>
                <td className="px-3 py-2 text-xs text-gray-400">{user.sourceFile}</td>
                <td className="px-3 py-2">
                  {isTarget(user.company) ? (
                    <span className="text-green-600">✓</span>
                  ) : (
                    <span className="text-gray-300">—</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {filtered.length > 100 && (
        <p className="text-center text-sm text-gray-400">
          Показаны первые 100 из {filtered.length} записей
        </p>
      )}
      {filtered.length === 0 && (
        <div className="text-center py-8 text-gray-400">
          <p>Нет данных для отображения</p>
        </div>
      )}
    </div>
  );
};

export default TrueConfView;
