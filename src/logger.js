const TAG = '[GrassTouchers]';

export class Logger {
  constructor(scope) {
    this.prefix = scope ? `${TAG}[${scope}]` : TAG;
  }

  log(...args) {
    console.log(this.prefix, ...args);
  }

  warn(...args) {
    console.warn(this.prefix, ...args);
  }

  error(...args) {
    console.error(this.prefix, ...args);
  }

  debug(...args) {
    console.debug(this.prefix, ...args);
  }
}

export const logger = new Logger();
