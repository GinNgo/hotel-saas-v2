export interface Province {
  code: string;
  name: string;
  type: string;
}

export interface Ward {
  code: string;
  name: string;
  type: string;
  provinceCode: string;
  provinceName: string;
}
