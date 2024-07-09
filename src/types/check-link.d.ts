export type CheckLinkResponseType = {
  status: string;
  message: string;
  isIndex?: boolean;
  isFollow?: boolean;
};

export type CheckIndexExternalResponseType = {
  status: string;
  message?: string;
};

export type IndexSinbyteResponseType = {
  status: string;
  message?: string;
};

export type IndexSinbyteDto = {
  apikey: string;
  name: string;
  dripfeed: string;
  urls: string[];
};
