/// <reference types="vite/client" />

declare global {
  interface Window {
    OpenCascadeModule: any;
    OpenCascade: any;
    appState?: any;
    logger?: any;
  }
}

// إضافة تعريفات للـ OpenCASCADE
declare module 'opencascade.js' {
  export default function OpenCascade(config?: any): Promise<any>;
}

// تعريفات للملفات الثابتة
declare module '*.svg' {
  const content: string;
  export default content;
}

declare module '*.png' {
  const content: string;
  export default content;
}

declare module '*.jpg' {
  const content: string;
  export default content;
}

declare module '*.jpeg' {
  const content: string;
  export default content;
}

declare module '*.gif' {
  const content: string;
  export default content;
}

declare module '*.wasm' {
  const content: string;
  export default content;
}

// تعريفات للـ Three.js extensions
declare module 'three/examples/jsm/controls/OrbitControls.js' {
  import { Camera, EventDispatcher, MOUSE, TOUCH, Vector3 } from 'three';
  
  export class OrbitControls extends EventDispatcher {
    constructor(object: Camera, domElement?: HTMLElement);
    
    object: Camera;
    domElement: HTMLElement | Document;
    
    // API
    enabled: boolean;
    target: Vector3;
    
    // Mouse buttons
    mouseButtons: { LEFT?: MOUSE; MIDDLE?: MOUSE; RIGHT?: MOUSE };
    
    // Touch fingers
    touches: { ONE?: TOUCH; TWO?: TOUCH };
    
    // Limits
    minDistance: number;
    maxDistance: number;
    minZoom: number;
    maxZoom: number;
    minPolarAngle: number;
    maxPolarAngle: number;
    minAzimuthAngle: number;
    maxAzimuthAngle: number;
    
    // Internals
    enableDamping: boolean;
    dampingFactor: number;
    enableZoom: boolean;
    zoomSpeed: number;
    enableRotate: boolean;
    rotateSpeed: number;
    enablePan: boolean;
    panSpeed: number;
    screenSpacePanning: boolean;
    keyPanSpeed: number;
    autoRotate: boolean;
    autoRotateSpeed: number;
    enableKeys: boolean;
    
    // Methods
    update(): boolean;
    saveState(): void;
    reset(): void;
    dispose(): void;
    getPolarAngle(): number;
    getAzimuthalAngle(): number;
    getDistance(): number;
    listenToKeyEvents(domElement: HTMLElement): void;
    stopListenToKeyEvents(): void;
  }
}

export {};