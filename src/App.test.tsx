import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import App from './App';

describe('device-to-chat journey', () => {
  it('opens desktop demo, sends text and retains the conversation when switching to phone', async () => {
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: /Компьютер/ }));
    fireEvent.click(screen.getByRole('button', { name: /Попробовать без подключения/ }));
    expect(screen.getAllByText('Михаил Степашкин').length).toBeGreaterThan(0);
    const composer = screen.getByRole('textbox', { name: 'Сообщение' });
    fireEvent.change(composer, { target: { value: 'Проверка общей переписки' } });
    fireEvent.click(screen.getByRole('button', { name: 'Отправить сообщение' }));
    await waitFor(() => expect(within(screen.getByRole('region', { name: 'Переписка: Михаил Степашкин' })).getByText('Проверка общей переписки')).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: 'Настройки' }));
    fireEvent.click(screen.getByRole('button', { name: 'Телефон' }));
    expect(screen.getByLabelText('iPhone 17')).toBeInTheDocument();
    expect(within(screen.getByRole('region', { name: 'Переписка: Михаил Степашкин' })).getByText('Проверка общей переписки')).toBeInTheDocument();
  });
  it('creates a new chat from a formatted number in the demo', async () => {
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: /Компьютер/ }));
    fireEvent.click(screen.getByRole('button', { name: /Попробовать без подключения/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Новый чат' }));
    fireEvent.change(screen.getByRole('textbox', { name: 'Номер телефона' }), { target: { value: '+7 (999) 111-22-33' } });
    fireEvent.click(screen.getByRole('button', { name: 'Создать чат' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(screen.getAllByText('+79991112233').length).toBeGreaterThan(0);
  });
});
