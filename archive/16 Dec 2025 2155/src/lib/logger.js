const isDevelopment = import.meta.env.DEV;

const logger = {
  info: (message, ...args) => {
    console.log(`[BlackHorse INFO]: ${message}`, ...args);
  },
  warn: (message, ...args) => {
    console.warn(`[BlackHorse WARN]: ${message}`, ...args);
  },
  error: (message, ...args) => {
    console.error(`[BlackHorse ERROR]: ${message}`, ...args);
  },
  debug: (message, ...args) => {
    if (isDevelopment) {
      console.debug(`[BlackHorse DEBUG]: ${message}`, ...args);
    }
  },
};

export default logger;