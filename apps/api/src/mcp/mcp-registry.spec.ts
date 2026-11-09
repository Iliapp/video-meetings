import { McpRegistrar, McpRegistry } from './mcp-registry';

describe('McpRegistry', () => {
  const registrar = (): McpRegistrar => ({ register: jest.fn() });

  it('keeps registrars in the order they were added', () => {
    const registry = new McpRegistry();
    const a = registrar();
    const b = registrar();
    registry.add(a);
    registry.add(b);
    expect(registry.list()).toEqual([a, b]);
  });

  it('ignores a registrar added twice', () => {
    const registry = new McpRegistry();
    const a = registrar();
    registry.add(a);
    registry.add(a);
    expect(registry.list()).toHaveLength(1);
  });
});
