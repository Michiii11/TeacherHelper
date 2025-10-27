import {environment} from '../environments/environment'

export abstract class Config {
  static readonly BACKEND_URL = environment.BACKEND_URL;
  static readonly API_URL = `${Config.BACKEND_URL}/api/`;
  static readonly SOCKET_URL = environment.SOCKET_URL;
}
