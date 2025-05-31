declare module 'opencascade.js' {
    const opencascade: {
        ready: Promise<void>;
        [key: string]: any;
    };
    
    export default opencascade;
}