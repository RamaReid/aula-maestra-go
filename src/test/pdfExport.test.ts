import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { downloadStructuredPdf } from "@/lib/pdfExport";

describe("downloadStructuredPdf", () => {
  const originalCreateObjectURL = URL.createObjectURL;
  const originalRevokeObjectURL = URL.revokeObjectURL;

  beforeEach(() => {
    URL.createObjectURL = vi.fn(() => "blob:test-url");
    URL.revokeObjectURL = vi.fn();
  });

  afterEach(() => {
    URL.createObjectURL = originalCreateObjectURL;
    URL.revokeObjectURL = originalRevokeObjectURL;
    vi.restoreAllMocks();
  });

  it("creates a downloadable pdf link", () => {
    const appendSpy = vi.spyOn(document.body, "appendChild");
    const removeSpy = vi.spyOn(document.body, "removeChild");
    const clickSpy = vi
      .spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementation(() => {});

    downloadStructuredPdf({
      title: "Material Didactico",
      filename: "salida.pdf",
      sections: [
        { title: "Proposito", body: ["Texto de prueba"] },
        { title: "Cierre", body: ["Fin de la clase"] },
      ],
    });

    expect(URL.createObjectURL).toHaveBeenCalledTimes(1);
    expect(clickSpy).toHaveBeenCalledTimes(1);
    expect(appendSpy).toHaveBeenCalledTimes(1);
    expect(removeSpy).toHaveBeenCalledTimes(1);
    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:test-url");
  });
});
