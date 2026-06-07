import { loadGatewayConfig, loadMaskingConfig } from './config/loader';
import { buildApp } from './app';

async function main() {
  const gatewayConfig = loadGatewayConfig();
  const maskingConfig = loadMaskingConfig();

  const app = await buildApp(gatewayConfig, maskingConfig);

  try {
    await app.listen({
      host: gatewayConfig.server.host,
      port: gatewayConfig.server.port,
    });
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

main();
