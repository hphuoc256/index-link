import axios, { AxiosInstance, AxiosResponse } from 'axios';

export class AxiosService {
  private static _instance: AxiosService;

  private readonly _api: AxiosInstance;

  constructor() {
    this._api = axios.create();

    this._api.interceptors.request.use(
      (config) => {
        return config;
      },
      (error) => {
        return Promise.reject(error);
      },
    );

    this._api.interceptors.response.use(
      (response: AxiosResponse | any) => {
        return response.data;
      },
      function (error) {
        return Promise.reject(error);
      },
    );
  }

  static instance(): AxiosService {
    if (!this._instance) this._instance = new AxiosService();
    return this._instance;
  }

  public get axios(): AxiosInstance {
    return this._api;
  }

  public setBearerToken(token: string) {
    this._api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
  }
}
