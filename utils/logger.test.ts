describe('logger', () => {
  const originalDev = (global as any).__DEV__;

  afterEach(() => {
    (global as any).__DEV__ = originalDev;
    jest.restoreAllMocks();
    jest.resetModules();
  });

  function loadLogger() {
    // logger reads __DEV__ once at module load time, so each scenario needs
    // its own fresh module instance.
    return require('./logger').logger;
  }

  it('logs info/success/warn/debug when __DEV__ is true', () => {
    (global as any).__DEV__ = true;
    const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

    const logger = loadLogger();
    logger.info('hello');
    logger.success('done');
    logger.warn('careful');
    logger.debug('label', { a: 1 });

    expect(logSpy).toHaveBeenCalledWith('ℹ️', 'hello');
    expect(logSpy).toHaveBeenCalledWith('✅', 'done');
    expect(warnSpy).toHaveBeenCalledWith('⚠️', 'careful');
    expect(logSpy).toHaveBeenCalledWith('🔍 label:', { a: 1 });
  });

  it('silences info/success/warn/debug when __DEV__ is false', () => {
    (global as any).__DEV__ = false;
    const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

    const logger = loadLogger();
    logger.info('hello');
    logger.success('done');
    logger.warn('careful');
    logger.debug('label', { a: 1 });

    expect(logSpy).not.toHaveBeenCalled();
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it('always logs errors, even when __DEV__ is false', () => {
    (global as any).__DEV__ = false;
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    const logger = loadLogger();
    logger.error('boom');

    expect(errorSpy).toHaveBeenCalledWith('❌', 'boom');
  });
});
