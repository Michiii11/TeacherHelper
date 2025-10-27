import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { AppComponent } from './app/app.component';
import {registerLocaleData} from '@angular/common'
import localeDe from '@angular/common/locales/de';

registerLocaleData(localeDe)

bootstrapApplication(AppComponent, appConfig)
  .catch((err) => console.error(err));
