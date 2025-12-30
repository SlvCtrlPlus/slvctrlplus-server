const validAutomationScriptFileNameRegexp = /^[a-z\d._-]+\.js$/;

export const isValidAutomationScriptFileName = (fileName: string): boolean =>
    validAutomationScriptFileNameRegexp.test(fileName);
