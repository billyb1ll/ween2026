import { createImmichService } from "./src/lib/immich/index";
const immich = createImmichService({ baseUrl: "http://192.168.137.1:2284", apiKey: "guSZJC7DUuPGiowrqc7c1OKlMHPTzZ8BxC92EVRNGVs" });
immich.assets.searchMetadata({ personIds: [] }).then(async (res) => {
  const items = res.assets.items;
  if (items.length > 0) {
    const assetId = items[0].id;
    const fullAsset = await immich.assets.getById(assetId);
    console.log(JSON.stringify(fullAsset, null, 2));
  }
}).catch(console.error);
