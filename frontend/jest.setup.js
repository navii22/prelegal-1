import '@testing-library/jest-dom';

// Mock URL.createObjectURL and revokeObjectURL
global.URL.createObjectURL = jest.fn(() => 'blob:mock-url');
global.URL.revokeObjectURL = jest.fn();

// Mock Element.prototype.scrollIntoView for jsdom
window.HTMLElement.prototype.scrollIntoView = jest.fn();

