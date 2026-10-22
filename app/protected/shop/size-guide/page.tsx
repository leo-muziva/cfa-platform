import Link from "next/link";
import { SIZE_SECTIONS } from "./sizeGuide";

export default function SizeGuidePage() {
  return (
    <main className="mx-auto max-w-4xl p-8">
      <nav aria-label="Breadcrumb" className="text-sm text-gray-500 dark:text-white/60">
        <Link href="/protected/shop" className="underline-offset-4 hover:underline">
          Shop
        </Link>
        {" / "}
        <span>Size guide</span>
      </nav>

      <h1 className="mt-4 text-2xl font-semibold">Size guide</h1>
      <p className="mt-2 max-w-2xl text-gray-700 dark:text-white/75">
        Measure in centimetres over light clothing. If you fall between two
        sizes, order the larger one.
      </p>

      {/* Fifteen charts is a long page, so these jump straight to one. */}
      <div className="mt-6 rounded-xl border border-border p-4">
        <p className="mb-3 text-sm font-medium">Jump to</p>
        <div className="flex flex-wrap gap-2">
          {SIZE_SECTIONS.map(function (section) {
            return (
              <a
                key={section.id}
                href={"#" + section.id}
                className="rounded-lg border border-border px-3 py-1.5 text-xs underline-offset-4 hover:underline"
              >
                {section.title}
              </a>
            );
          })}
        </div>
      </div>

      <div className="mt-8 space-y-10">
        {SIZE_SECTIONS.map(function (section) {
          return (
            <section key={section.id} id={section.id} className="scroll-mt-24">
              <h2 className="text-lg font-medium">{section.title}</h2>

              {section.note ? (
                <p className="mt-1 text-sm text-gray-600 dark:text-white/60">
                  {section.note}
                </p>
              ) : null}

              {/* Each table scrolls sideways on its own. The LiNing shoe
                  chart has sixteen columns and would break the page. */}
              <div className="mt-3 overflow-x-auto rounded-xl border border-border">
                <table className="w-full border-collapse text-sm">
                  <thead>
                    <tr className="bg-gray-50 dark:bg-white/5">
                      {section.headers.map(function (heading, i) {
                        return (
                          <th
                            key={i}
                            className="whitespace-nowrap px-3 py-2 text-left font-medium text-gray-600 dark:text-white/60"
                          >
                            {heading}
                          </th>
                        );
                      })}
                    </tr>
                  </thead>
                  <tbody>
                    {section.rows.map(function (row, rowIndex) {
                      return (
                        <tr key={rowIndex} className="border-t border-border">
                          {row.map(function (cell, cellIndex) {
                            return (
                              <td
                                key={cellIndex}
                                className={
                                  "whitespace-nowrap px-3 py-2 " +
                                  (cellIndex === 0
                                    ? "font-medium text-gray-600 dark:text-white/60"
                                    : "")
                                }
                              >
                                {cell}
                              </td>
                            );
                          })}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </section>
          );
        })}
      </div>

      <p className="mt-10 text-sm text-gray-600 dark:text-white/60">
        Not sure which size to order? Ask your coach — they can help you
        measure.
      </p>
    </main>
  );
}