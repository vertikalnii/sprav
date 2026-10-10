import React, { useState, useRef, useEffect } from 'react';
import { Employee } from '../types';
import { generateId, generateTrueConfLink, generatePhoneCallLink } from '../utils/matching';

interface EmployeeTableProps {
  employees: Employee[];
  onUpdate: (employees: Employee[]) => void;
  isAdmin?: boolean;
}

// Поля, доступные для редактирования только администратору
const ADMIN_ONLY_FIELDS = new Set<keyof Employee>(['fullName', 'position', 'trueConfId']);

const EmployeeTable: React.FC<EmployeeTableProps> = ({ employees, onUpdate, isAdmin = false }) => {
  const [editingCell, setEditingCell] = useState<{ rowId: string; field: keyof Employee } | null>(null);
  const [editValue, setEditValue] = useState<string>('');
  const [filter, setFilter] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editingCell && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editingCell]);

  const handleCellClick = (rowId: string, field: keyof Employee) => {
    if (!isAdmin && ADMIN_ONLY_FIELDS.has(field)) return; // только для администратора
    const emp = employees.find(e => e.id === rowId);
    if (emp) {
      setEditValue(String(emp[field] || ''));
      setEditingCell({ rowId, field });
    }
  };

  const handleCellSave = () => {
    if (!editingCell) return;
    const updated = employees.map(emp => {
      if (emp.id === editingCell.rowId) {
        const newEmp = { ...emp, [editingCell.field]: editValue };
        // Auto-generate links if relevant fields changed
        if (editingCell.field === 'trueConfId') {
          newEmp.trueConfCallLink = generateTrueConfLink(editValue);
        }
        if (editingCell.field === 'phoneNumber' || editingCell.field === 'mobilePhone') {
          const phone = newEmp.phoneNumber || newEmp.mobilePhone;
          newEmp.phoneCallLink = generatePhoneCallLink(phone);
        }
        return newEmp;
      }
      return emp;
    });
    onUpdate(updated);
    setEditingCell(null);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleCellSave();
    } else if (e.key === 'Escape') {
      setEditingCell(null);
    }
  };

  const handleAddRow = () => {
    const newEmployee: Employee = {
      id: generateId(),
      fullName: '',
      position: '',
      officeNumber: '',
      phoneNumber: '',
      mobilePhone: '',
      lineType: '',
      trueConfCallLink: '',
      phoneCallLink: '',
      trueConfId: '',
      phoneCount: '',
      matchStatus: 'new'
    };
    onUpdate([...employees, newEmployee]);
  };

  const handleDeleteRow = (id: string) => {
    onUpdate(employees.filter(e => e.id !== id));
  };

  const filteredEmployees = employees.filter(emp => {
    const matchesText = !filter || 
      emp.fullName.toLowerCase().includes(filter.toLowerCase()) ||
      emp.position.toLowerCase().includes(filter.toLowerCase()) ||
      emp.trueConfId.toLowerCase().includes(filter.toLowerCase());
    
    const matchesStatus = statusFilter === 'all' || emp.matchStatus === statusFilter;
    
    return matchesText && matchesStatus;
  });

  const getRowClass = (emp: Employee) => {
    switch (emp.matchStatus) {
      case 'matched': return 'bg-green-50 hover:bg-green-100';
      case 'unmatched': return 'bg-yellow-50 hover:bg-yellow-100';
      case 'conflict': return 'bg-red-50 hover:bg-red-100';
      case 'new': return 'bg-blue-50 hover:bg-blue-100';
      default: return 'hover:bg-gray-50';
    }
  };

  const getStatusBadge = (status?: string) => {
    switch (status) {
      case 'matched': return <span className="px-2 py-0.5 text-xs rounded-full bg-green-200 text-green-800">✓ Найден</span>;
      case 'unmatched': return <span className="px-2 py-0.5 text-xs rounded-full bg-yellow-200 text-yellow-800">⚠ Не найден</span>;
      case 'conflict': return <span className="px-2 py-0.5 text-xs rounded-full bg-red-200 text-red-800">✕ Конфликт</span>;
      case 'new': return <span className="px-2 py-0.5 text-xs rounded-full bg-blue-200 text-blue-800">+ Новый</span>;
      default: return <span className="px-2 py-0.5 text-xs rounded-full bg-gray-200 text-gray-600">—</span>;
    }
  };

  const renderCell = (emp: Employee, field: keyof Employee) => {
    const isEditing = editingCell?.rowId === emp.id && editingCell?.field === field;
    const value = String(emp[field] || '');
    const locked = !isAdmin && ADMIN_ONLY_FIELDS.has(field);

    if (isEditing && !locked) {
      return (
        <input
          ref={inputRef}
          type="text"
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onBlur={handleCellSave}
          onKeyDown={handleKeyDown}
          className="w-full px-2 py-1 border border-blue-400 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
        />
      );
    }

    return (
      <div
        onClick={() => handleCellClick(emp.id, field)}
        className={`px-2 py-1.5 rounded min-h-[28px] truncate text-sm ${
          locked ? 'cursor-default' : 'cursor-pointer hover:bg-blue-50'
        }`}
        title={locked ? 'Редактирование доступно только Администратору' : value}
      >
        {value || <span className="text-gray-300">—</span>}
      </div>
    );
  };

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="flex-1 min-w-[200px]">
          <input
            type="text"
            placeholder="🔍 Поиск по ФИО, должности, ID..."
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="all">Все статусы</option>
          <option value="matched">✓ Найден в TC</option>
          <option value="unmatched">⚠ Не найден в TC</option>
          <option value="conflict">✕ Конфликт</option>
          <option value="new">+ Новый</option>
        </select>
        <button
          onClick={handleAddRow}
          disabled={!isAdmin}
          title={isAdmin ? 'Добавить запись' : 'Только Администратор'}
          className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 transition-colors flex items-center gap-1 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <span>+</span> Добавить строку
        </button>
        <div className="text-sm text-gray-500">
          Показано: {filteredEmployees.length} из {employees.length}
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto border border-gray-200 rounded-xl shadow-sm">
        <table className="w-full text-sm">
          <thead className="bg-gray-100 sticky top-0">
            <tr>
              <th className="px-3 py-3 text-left font-semibold text-gray-600 w-8">№</th>
              <th className="px-3 py-3 text-left font-semibold text-gray-600 min-w-[200px]">ФИО</th>
              <th className="px-3 py-3 text-left font-semibold text-gray-600 min-w-[150px]">Должность</th>
              <th className="px-3 py-3 text-left font-semibold text-gray-600 w-20">Каб.</th>
              <th className="px-3 py-3 text-left font-semibold text-gray-600 min-w-[130px]">Телефон</th>
              <th className="px-3 py-3 text-left font-semibold text-gray-600 min-w-[130px]">Мобильный</th>
              <th className="px-3 py-3 text-left font-semibold text-gray-600 w-24">Тип линии</th>
              <th className="px-3 py-3 text-left font-semibold text-gray-600 min-w-[100px]">ID TrueConf</th>
              <th className="px-3 py-3 text-left font-semibold text-gray-600 w-24">Статус</th>
              <th className="px-3 py-3 text-left font-semibold text-gray-600 w-12"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {filteredEmployees.map((emp, idx) => (
              <tr key={emp.id} className={`${getRowClass(emp)} transition-colors`}>
                <td className="px-3 py-1 text-gray-400 text-xs">{idx + 1}</td>
                <td className="px-1 py-1 font-medium">{renderCell(emp, 'fullName')}</td>
                <td className="px-1 py-1">{renderCell(emp, 'position')}</td>
                <td className="px-1 py-1">{renderCell(emp, 'officeNumber')}</td>
                <td className="px-1 py-1">{renderCell(emp, 'phoneNumber')}</td>
                <td className="px-1 py-1">{renderCell(emp, 'mobilePhone')}</td>
                <td className="px-1 py-1">{renderCell(emp, 'lineType')}</td>
                <td className="px-1 py-1">
                  {emp.trueConfId ? (
                    <div className="flex items-center gap-1">
                      <a
                        href={emp.trueConfCallLink || generateTrueConfLink(emp.trueConfId)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:text-blue-800 hover:underline text-xs font-mono truncate"
                        title={`Звонок в TrueConf по ID: ${emp.trueConfId}`}
                      >
                        {emp.trueConfId}
                      </a>
                      <a
                        href={generateTrueConfLink(emp.trueConfId)}
                        title="Позвонить через TrueConf"
                        className="shrink-0 text-green-700 hover:text-green-900"
                      >📞</a>
                    </div>
                  ) : renderCell(emp, 'trueConfId')}
                </td>
                <td className="px-3 py-1">{getStatusBadge(emp.matchStatus)}</td>
                <td className="px-2 py-1">
                  {(emp.phoneNumber || emp.mobilePhone) ? (
                    <a
                      href={generatePhoneCallLink(emp.phoneNumber || emp.mobilePhone)}
                      title={`Позвонить на номер ${emp.phoneNumber || emp.mobilePhone} из TrueConf`}
                      className="text-indigo-700 hover:text-indigo-900"
                    >📲</a>
                  ) : null}
                  {isAdmin ? (
                    <button
                      onClick={() => handleDeleteRow(emp.id)}
                      className="text-red-400 hover:text-red-600 transition-colors text-lg"
                      title="Удалить строку"
                    >
                      ×
                    </button>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {filteredEmployees.length === 0 && (
        <div className="text-center py-12 text-gray-400">
          <div className="text-4xl mb-3">📋</div>
          <p>Нет данных для отображения</p>
          <p className="text-sm">Загрузите справочник или добавьте сотрудников вручную</p>
        </div>
      )}
    </div>
  );
};

export default EmployeeTable;
