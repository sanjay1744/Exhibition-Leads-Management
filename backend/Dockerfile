FROM mcr.microsoft.com/dotnet/sdk:9.0 AS build
WORKDIR /src

# Copy project files
COPY ["src/ExhibitionLeads.Api/ExhibitionLeads.Api.csproj", "src/ExhibitionLeads.Api/"]
COPY ["src/ExhibitionLeads.Core/ExhibitionLeads.Core.csproj", "src/ExhibitionLeads.Core/"]
COPY ["src/ExhibitionLeads.Infrastructure/ExhibitionLeads.Infrastructure.csproj", "src/ExhibitionLeads.Infrastructure/"]

# Restore using single thread to save memory on free tier
RUN dotnet restore "src/ExhibitionLeads.Api/ExhibitionLeads.Api.csproj" --disable-parallel

# Copy full source
COPY . .

# Publish directly with memory constraints (/m:1 and /p:BuildInParallel=false)
WORKDIR "/src/src/ExhibitionLeads.Api"
RUN dotnet publish "ExhibitionLeads.Api.csproj" -c Release -o /app/publish /p:UseAppHost=false /m:1 /p:BuildInParallel=false /p:ServerGarbageCollection=false

FROM mcr.microsoft.com/dotnet/aspnet:9.0 AS final
WORKDIR /app
COPY --from=build /app/publish .

ENV ASPNETCORE_ENVIRONMENT=Production
ENV PORT=5000
EXPOSE 5000

ENTRYPOINT ["dotnet", "ExhibitionLeads.Api.dll"]
