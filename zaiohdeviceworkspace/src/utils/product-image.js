import ct21b from '@/assets/img/products/ct21b.png';
import ct23 from '@/assets/img/products/ct23.png';

// 仅映射已有实物图片的型号；未知产品不借用其它设备的外观。
export function getProductImage(model) {
  const normalized = typeof model === 'string' ? model.trim().toUpperCase().replace(/^ZAIOHOS-/, '') : '';
  if (normalized === 'CT21B') return ct21b;
  if (normalized === 'CT23') return ct23;
  return null;
}
