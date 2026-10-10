import React, { useState } from 'react';
import { checkPassword, setPassword, isPasswordConfigured, DEFAULT_PASSWORD } from '../utils/auth';

interface AdminLoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const AdminLoginModal: React.FC<AdminLoginModalProps> = ({ isOpen, onClose, onSuccess }) => {
  const [pass, setPass] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const firstRun = !isPasswordConfigured();

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (firstRun) {
      if (pass.length < 4) {
        setError('Пароль должен быть не короче 4 символов');
        return;
      }
      if (pass !== confirm) {
        setError('Пароли не совпадают');
        return;
      }
      setPassword(pass);
      onSuccess();
    } else {
      if (checkPassword(pass)) {
        onSuccess();
      } else {
        setError('Неверный пароль администратора');
      }
    }
  };

  return (
    <div className="fixed inset-0 z-[70] bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
      <form
        onSubmit={handleSubmit}
        className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 space-y-4"
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-amber-100 rounded-xl flex items-center justify-center text-xl">🔐</div>
          <div>
            <h2 className="font-bold text-gray-800">Вход в режим Администратора</h2>
            <p className="text-xs text-gray-500">
              {firstRun ? `Первый запуск — задайте пароль (по умолчанию можно оставить «${DEFAULT_PASSWORD}») или придумайте свой` : 'Введите пароль администратора'}
            </p>
          </div>
        </div>

        <input
          type="password"
          autoFocus
          value={pass}
          onChange={(e) => setPass(e.target.value)}
          placeholder="Пароль"
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 text-sm"
        />
        {firstRun && (
          <input
            type="password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            placeholder="Повторите пароль"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 text-sm"
          />
        )}

        {error && <p className="text-sm text-red-600">{error}</p>}

        <div className="flex gap-2 justify-end pt-1">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-50"
          >
            Отмена
          </button>
          <button
            type="submit"
            className="px-4 py-2 text-sm rounded-lg bg-amber-500 text-white font-medium hover:bg-amber-600"
          >
            Войти
          </button>
        </div>
      </form>
    </div>
  );
};

export default AdminLoginModal;
