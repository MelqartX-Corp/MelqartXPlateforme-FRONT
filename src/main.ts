(window as any).global = window;
(window as any).process = (window as any).process || {
  env: { DEBUG: undefined },
  nextTick: (fn: any, ...args: any[]) => setTimeout(() => fn(...args), 0),
  browser: true,
  version: ''
};

import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { AppComponent } from './app/app.component';

bootstrapApplication(AppComponent, appConfig)
  .catch((err) => console.error(err));
