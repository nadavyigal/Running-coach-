/**
 * MapLibre GL JS Mock for Testing
 * Provides mock implementations of MapLibre classes and methods
 */

import { vi } from 'vitest';

export const createMapLibreMock = () => {
  const mockMap = {
    on: vi.fn((event: string, callback: () => void) => {
      // Auto-trigger 'load' event for tests
      if (event === 'load') {
        setTimeout(() => callback(), 0);
      }
      return mockMap;
    }),
    off: vi.fn(),
    remove: vi.fn(),
    addSource: vi.fn(),
    removeSource: vi.fn(),
    getSource: vi.fn(),
    addLayer: vi.fn(),
    removeLayer: vi.fn(),
    getLayer: vi.fn(),
    setStyle: vi.fn(),
    fitBounds: vi.fn(),
    flyTo: vi.fn(),
    jumpTo: vi.fn(),
    getCenter: vi.fn(() => ({ lng: 34.7818, lat: 32.0853 })),
    getZoom: vi.fn(() => 13),
    getBounds: vi.fn(() => ({
      getNorth: () => 32.1,
      getSouth: () => 32.0,
      getEast: () => 34.8,
      getWest: () => 34.7,
    })),
    addControl: vi.fn(),
    removeControl: vi.fn(),
    resize: vi.fn(),
  };

  const mockMarker = {
    setLngLat: vi.fn().mockReturnThis(),
    addTo: vi.fn().mockReturnThis(),
    remove: vi.fn(),
    setPopup: vi.fn().mockReturnThis(),
    togglePopup: vi.fn().mockReturnThis(),
    getElement: vi.fn(() => document.createElement('div')),
  };

  const mockPopup = {
    setLngLat: vi.fn().mockReturnThis(),
    setHTML: vi.fn().mockReturnThis(),
    setText: vi.fn().mockReturnThis(),
    addTo: vi.fn().mockReturnThis(),
    remove: vi.fn(),
    isOpen: vi.fn(() => false),
  };

  return {
    Map: vi.fn(() => mockMap),
    Marker: vi.fn(() => mockMarker),
    Popup: vi.fn(() => mockPopup),
    NavigationControl: vi.fn(),
    GeolocateControl: vi.fn(),
    ScaleControl: vi.fn(),
    FullscreenControl: vi.fn(),
  };
};

// Mock module export
vi.mock('maplibre-gl', () => {
  const mock = createMapLibreMock();
  return {
    default: mock,
    ...mock,
  };
});
