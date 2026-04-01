interface NorthStarProps {
  data: {
    position: string;
    positionDetail: string;
    project: string;
    projectDetail: string;
  };
}

export default function NorthStar({ data }: NorthStarProps) {
  if (!data?.position && !data?.project) return null;

  return (
    <section className="py-20 px-8 lg:px-16">
      <div className="max-w-6xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
          <div className="lg:col-span-3">
            <h2 className="text-4xl md:text-5xl text-foreground tracking-tight">
              <span className="font-bold">The</span>{" "}
              <span className="font-light">North Star</span>
            </h2>
            <hr className="border-t-2 border-foreground mt-8" />
          </div>

          <div className="hidden lg:block lg:col-span-1" />
          <div className="lg:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-10">
            {data.position && (
              <div className="space-y-3">
                <span className="inline-block bg-foreground text-background text-xs font-semibold tracking-widest uppercase px-4 py-1.5 rounded-full">
                  Position
                </span>
                <p className="text-lg font-bold text-foreground leading-snug">{data.position}</p>
                {data.positionDetail && (
                  <p className="text-sm text-muted-foreground leading-relaxed">{data.positionDetail}</p>
                )}
              </div>
            )}
            {data.project && (
              <div className="space-y-3">
                <span className="inline-block bg-foreground text-background text-xs font-semibold tracking-widest uppercase px-4 py-1.5 rounded-full">
                  Project
                </span>
                <p className="text-lg font-bold text-foreground leading-snug">{data.project}</p>
                {data.projectDetail && (
                  <p className="text-sm text-muted-foreground leading-relaxed">{data.projectDetail}</p>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
